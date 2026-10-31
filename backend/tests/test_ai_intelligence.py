import pytest
from fastapi.testclient import TestClient

from app.ai.classifier import DomainHeuristicClassifier, GeminiClassifier, DEPARTMENT_MAP
from app.ai.duplicate_detector import DuplicateDetector
from app.ai.embedding import EmbeddingEngine
from app.core.config import settings
from app.core.security import create_access_token


class TestDenseSentenceEmbeddings:
    """Verifies dense vector generation, caching, and cosine similarity."""

    def test_embedding_engine_dense_vectors(self):
        text_a = "Wi-Fi disconnected in the computer laboratory"
        text_b = "Internet network offline in campus computer hall"
        text_c = "Leaking water faucet in dormitory restroom"

        emb_a = EmbeddingEngine.encode(text_a)
        emb_b = EmbeddingEngine.encode(text_b)
        emb_c = EmbeddingEngine.encode(text_c)

        # Check dimension (384-dimensional for all-MiniLM-L6-v2)
        assert len(emb_a) == 384
        assert len(emb_b) == 384
        assert len(emb_c) == 384

        # Semantic similarity between related IT phrases should be distinctly higher than unrelated plumbing
        sim_ab = EmbeddingEngine.cosine_similarity(emb_a, emb_b)
        sim_ac = EmbeddingEngine.cosine_similarity(emb_a, emb_c)

        assert sim_ab > 0.40, f"Expected high similarity between related IT texts, got {sim_ab}"
        assert sim_ab > sim_ac, f"Expected sim_ab ({sim_ab}) > sim_ac ({sim_ac})"

    def test_embedding_engine_empty_input(self):
        emb_empty = EmbeddingEngine.encode("")
        assert len(emb_empty) == 384
        assert (emb_empty == 0).all()

        sim = EmbeddingEngine.cosine_similarity(emb_empty, emb_empty)
        assert sim == 0.0


class TestSemanticDuplicateDetection:
    """Verifies that differently-worded complaints are recognized as semantic duplicates."""

    @pytest.fixture
    def candidate_complaints(self):
        return [
            {
                "id": "cmp-net-1",
                "ticket": "CSI-1001",
                "title": "Wi-Fi signal drops frequently in Central Library",
                "description": "Continuous disconnection from campus network when using laptops in reading hall.",
                "category": "it",
                "location": "Central Library Floor 2",
                "status": "submitted",
                "priority": "medium",
            },
            {
                "id": "cmp-elec-1",
                "ticket": "CSI-1002",
                "title": "Exposed high voltage wire sparking in hallway",
                "description": "Live electric cable dangling near ground floor entrance.",
                "category": "safety",
                "location": "Main Hallway Ground Floor",
                "status": "submitted",
                "priority": "critical",
            },
            {
                "id": "cmp-hvac-1",
                "ticket": "CSI-1003",
                "title": "Air conditioning unit leaking water in study room",
                "description": "Ceiling AC unit is dripping water directly onto student desks.",
                "category": "facilities",
                "location": "Study Hall B",
                "status": "in_progress",
                "priority": "medium",
            },
        ]

    def test_detect_paraphrased_duplicate(self, candidate_complaints):
        # Different vocabulary for CSI-1001: "internet" instead of "wi-fi", "portal offline"
        matches = DuplicateDetector.find_duplicates(
            title="Internet connection completely failing in library reading room",
            description="Students cannot access portal or web in the library area.",
            category="it",
            location="Central Library",
            candidates=candidate_complaints,
            threshold=0.45,
            limit=5,
        )

        assert len(matches) >= 1
        top_match = matches[0]
        assert top_match["ticket"] == "CSI-1001"
        assert top_match["similarity_score"] >= 0.50
        assert "dense_similarity" in top_match
        assert top_match["dense_similarity"] >= 0.40
        assert "evidence" in top_match
        assert len(top_match["evidence"]) > 0

    def test_detect_distinct_complaint_no_false_positive(self, candidate_complaints):
        # A completely distinct issue: Bus schedule delayed
        matches = DuplicateDetector.find_duplicates(
            title="Campus shuttle bus did not arrive on time",
            description="Route 3 bus is 45 minutes late causing missed morning lectures.",
            category="transport",
            location="North Gate Bus Stop",
            candidates=candidate_complaints,
            threshold=0.65,
        )

        # Should not match library wifi or sparking wire at high threshold
        matching_tickets = [m["ticket"] for m in matches]
        assert "CSI-1001" not in matching_tickets
        assert "CSI-1002" not in matching_tickets

    def test_suggested_clusters_no_automatic_merge(self):
        complaints = [
            {
                "id": "c1",
                "ticket": "CSI-201",
                "title": "Broken elevator in engineering building",
                "description": "Lift stuck between floor 2 and 3.",
                "category": "facilities",
                "location": "Engineering Building",
            },
            {
                "id": "c2",
                "ticket": "CSI-202",
                "title": "Lift not operating in engineering hall",
                "description": "Elevator out of service on 2nd floor.",
                "category": "facilities",
                "location": "Engineering Building",
            },
            {
                "id": "c3",
                "ticket": "CSI-203",
                "title": "Hostel mess dinner cold",
                "description": "Food quality issue in dining hall.",
                "category": "hostel",
                "location": "Hostel 1",
            },
        ]

        clusters = DuplicateDetector.cluster_candidates(complaints, threshold=0.50)
        assert len(clusters) == 1
        cluster = clusters[0]
        assert cluster["primary_ticket"] in ["CSI-201", "CSI-202"]
        assert "evidence" in cluster
        assert cluster["average_similarity"] >= 0.50
        # Verify it provides suggestion metadata without mutating original records
        assert "member_ids" in cluster


class TestAIExplainableClassification:
    """Verifies category prediction, severity triage, department routing, and explainability."""

    def test_safety_critical_classification_with_explainability(self):
        res = DomainHeuristicClassifier.classify(
            title="Sparks and smoke from open power outlet in physics lab",
            description="Exposed wire is smoking and creates an immediate danger of fire.",
            location="Physics Lab 204",
        )

        assert res["category"] == "safety"
        assert res["priority"] == "critical"
        assert res["urgency_score"] >= 0.90
        assert res["category_confidence"] >= 0.70
        assert "Department of Campus Security & Safety" in res["department_hint"] or "Security" in res["department_hint"]
        assert res["department_code"] == "SEC"

        # Explainability fields
        assert len(res["category_reasons"]) > 0
        assert any("safety" in r.lower() for r in res["category_reasons"])
        assert len(res["priority_reasons"]) > 0
        assert any("safety" in r.lower() or "hazard" in r.lower() for r in res["priority_reasons"])
        assert "rule-based fallback" in res["model_used"]

    def test_it_service_routing(self):
        res = DomainHeuristicClassifier.classify(
            title="Cannot log into student LMS portal to submit assignment",
            description="Moodle server returning error 500 across campus network.",
        )

        assert res["category"] == "it"
        assert res["department_hint"] == "Campus IT Services"
        assert res["department_code"] == "IT"
        assert "it" in res["category_reasons"][0].lower() or "lms" in str(res["category_reasons"]).lower()

    def test_facilities_plumbing_routing(self):
        res = DomainHeuristicClassifier.classify(
            title="Restroom water tap broken and overflowing",
            description="Continuous water leak flooding the 3rd floor washroom.",
            location="Block A Restroom",
        )

        assert res["category"] == "facilities"
        assert res["department_code"] == "FAC"
        assert res["priority"] in ["medium", "high", "critical"]

    def test_department_map_completeness(self):
        for cat, (name, code, desc) in DEPARTMENT_MAP.items():
            assert len(name) > 3
            assert len(code) >= 2
            assert len(desc) > 10


class TestAIFailureAndFallbackHandling:
    """Verifies graceful handling of missing API keys, network errors, and invalid inputs."""

    def test_gemini_fallback_when_api_key_empty(self, monkeypatch):
        # Force empty GEMINI_API_KEY
        monkeypatch.setattr(settings, "gemini_api_key", "")
        res = GeminiClassifier.classify(
            title="Projector in auditorium bulb fused",
            description="Screen is blank during guest lecture.",
        )

        assert res["category"] == "it"
        assert "rule-based fallback" in res["model_used"]
        assert res["priority"] in ["low", "medium", "high"]

    def test_gemini_fallback_on_api_exception(self, monkeypatch):
        # Set a dummy key so it attempts Gemini invocation
        monkeypatch.setattr(settings, "gemini_api_key", "test-invalid-key-xyz")
        res = GeminiClassifier.classify(
            title="Broken chair in seminar hall",
            description="Wood cracked and unstable.",
        )

        # Must fall back gracefully to domain heuristic engine without throwing an unhandled exception
        assert res["category"] in ["facilities", "other"]
        assert "Gemini fallback" in res["reasoning"] or "fallback" in res["model_used"]


class TestAIEndpointsIntegration:
    """Verifies the HTTP endpoints for classification and duplicate detection."""

    def test_post_classify_endpoint_explainability(self, client: TestClient):
        token = create_access_token(
            data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            "/api/v1/ai/classify",
            headers=headers,
            json={
                "title": "Severe gas smell and hiss in chemistry lab",
                "description": "Possible gas leak near valve 4.",
                "location": "Chemistry Block 1",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "safety"
        assert data["priority"] == "critical"
        assert "categoryConfidence" in data
        assert "categoryReasons" in data
        assert "priorityReasons" in data
        assert "departmentCode" in data
        assert "modelUsed" in data

    def test_post_detect_duplicates_endpoint_semantic_evidence(self, client: TestClient):
        token = create_access_token(
            data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            "/api/v1/ai/detect-duplicates",
            headers=headers,
            json={
                "title": "Library level 2 reading hall air conditioning not working",
                "description": "AC cooling is completely down in central library 2nd floor.",
                "category": "facilities",
                "location": "Central Library",
                "threshold": 0.40,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        assert "hasDuplicates" in data
        assert "engine" in data
        if data["matches"]:
            match = data["matches"][0]
            assert "denseSimilarity" in match
            assert "evidence" in match
            assert "engine" in match

    def test_admin_only_suggested_duplicates_endpoint(self, client: TestClient):
        # Student should be forbidden (403)
        student_token = create_access_token(
            data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
        )
        res_stu = client.get(
            "/api/v1/ai/suggested-duplicates",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert res_stu.status_code == 403

        # Admin should succeed (200)
        admin_token = create_access_token(
            data={"sub": "user-admin", "email": "admin@campus.edu", "role": "admin"}
        )
        res_admin = client.get(
            "/api/v1/ai/suggested-duplicates",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res_admin.status_code == 200
        data = res_admin.json()
        assert "suggestedGroups" in data
        assert "totalCandidates" in data
