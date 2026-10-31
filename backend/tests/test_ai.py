from fastapi.testclient import TestClient

from app.ai.classifier import DomainHeuristicClassifier, GeminiClassifier
from app.ai.duplicate_detector import DuplicateDetector
from app.core.security import create_access_token


def test_domain_classifier_categories():
    res_wifi = DomainHeuristicClassifier.classify(
        title="Wi-Fi disconnects in computer lab",
        description="The network keeps dropping during lab hours.",
    )
    assert res_wifi["category"] == "it"

    res_hazard = DomainHeuristicClassifier.classify(
        title="Live electric wire exposed in hallway",
        description="Dangerous sparks coming from socket near water tap.",
    )
    assert res_hazard["category"] == "safety"
    assert res_hazard["priority"] == "critical"
    assert res_hazard["urgency_score"] >= 0.9

    res_mess = DomainHeuristicClassifier.classify(
        title="Hostel mess food quality is poor",
        description="Dinner food was cold and stale in the dining hall.",
    )
    assert res_mess["category"] == "hostel"

    res_ac = DomainHeuristicClassifier.classify(
        title="Library AC not cooling on 2nd floor",
        description="Air conditioning is failing in study hall.",
    )
    assert res_ac["category"] == "facilities"


def test_duplicate_detector_scoring():
    candidates = [
        {
            "id": "cmp-101",
            "ticket": "CSI-101",
            "title": "Wi-Fi not working on library floor 2",
            "description": "Cannot connect to campus wifi in library reading area.",
            "category": "it",
            "location": "Library Floor 2",
        },
        {
            "id": "cmp-102",
            "ticket": "CSI-102",
            "title": "Broken elevator in Science block",
            "description": "Lift is stuck on 4th floor.",
            "category": "facilities",
            "location": "Science Block",
        },
    ]

    # Query for duplicate of cmp-101
    matches = DuplicateDetector.find_duplicates(
        title="Library second floor wifi broken",
        description="Network is completely down in 2nd floor library.",
        category="it",
        location="Library Floor 2",
        candidates=candidates,
        threshold=0.45,
    )

    assert len(matches) >= 1
    assert matches[0]["ticket"] == "CSI-101"
    assert matches[0]["similarity_score"] >= 0.5
    assert "wifi" in matches[0]["matching_keywords"] or "library" in matches[0]["matching_keywords"]


def test_duplicate_detector_clustering():
    complaints = [
        {
            "id": "c1",
            "ticket": "CSI-01",
            "title": "Hostel 3 water pump leaking",
            "description": "Heavy water leak near hostel pump.",
            "category": "facilities",
            "location": "Hostel 3",
        },
        {
            "id": "c2",
            "ticket": "CSI-02",
            "title": "Hostel 3 leaking water pipe",
            "description": "Water leaking from pump room in Hostel 3.",
            "category": "facilities",
            "location": "Hostel 3",
        },
        {
            "id": "c3",
            "ticket": "CSI-03",
            "title": "Projector not working in Room 101",
            "description": "Bulb fused.",
            "category": "it",
            "location": "Room 101",
        },
    ]

    clusters = DuplicateDetector.cluster_candidates(complaints, threshold=0.45)
    assert len(clusters) == 1
    assert "CSI-01" in [clusters[0]["primary_ticket"], *clusters[0]["member_tickets"]]
    assert "CSI-02" in [clusters[0]["primary_ticket"], *clusters[0]["member_tickets"]]


def test_api_ai_classify_endpoint(client: TestClient):
    token = create_access_token(
        data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/ai/classify",
        headers=headers,
        json={
            "title": "Water leak in Block B 3rd floor restroom",
            "description": "Pipe is dripping water creating a large puddle on the floor.",
            "location": "Block B, Floor 3",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "facilities"
    assert data["priority"] in ["medium", "high", "critical"]
    assert "facilities" in data["summary"].lower() or "water" in data["summary"].lower()


def test_api_ai_detect_duplicates_endpoint(client: TestClient):
    token = create_access_token(
        data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Query duplicate against seeded "Library AC not cooling on level 2"
    response = client.post(
        "/api/v1/ai/detect-duplicates",
        headers=headers,
        json={
            "title": "Central library level 2 AC broken",
            "description": "Air conditioner reading hall warm since morning.",
            "category": "facilities",
            "threshold": 0.40,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "matches" in data
    assert "hasDuplicates" in data
    assert "sentence-transformers" in data["engine"] or "tfidf" in data["engine"]


def test_api_ai_suggested_duplicates_endpoint(client: TestClient):
    admin_token = create_access_token(
        data={"sub": "user-admin", "email": "admin@campus.edu", "role": "admin"}
    )
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    response = client.get("/api/v1/ai/suggested-duplicates", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "suggestedGroups" in data
    assert "totalCandidates" in data

    # Unauthenticated / student should be forbidden
    student_token = create_access_token(
        data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
    )
    res_student = client.get(
        "/api/v1/ai/suggested-duplicates",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res_student.status_code == 403
