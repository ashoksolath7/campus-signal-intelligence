import pytest
from fastapi.testclient import TestClient

from app.ai.classifier import DomainHeuristicClassifier, DEPARTMENT_MAP
from app.ai.duplicate_detector import DuplicateDetector
from app.core.config import settings
from app.core.security import create_access_token
from tests.conftest import make_verification_token


class TestPhase5StudentWorkflow:
    """End-to-end validation of complete student lifecycle."""

    test_student_email = "qa_student_e2e@student.campus.edu"
    test_student_password = "SecureQAPassword123!"

    def test_student_complete_journey(self, client: TestClient):
        # 1. Request OTP for registration
        otp_res = client.post("/api/v1/auth/send-otp", json={"email": self.test_student_email})
        assert otp_res.status_code == 200, f"Send OTP failed: {otp_res.text}"

        # 2. Register new student with OTP verification token
        v_token = make_verification_token(self.test_student_email)
        reg_res = client.post(
            "/api/v1/auth/register",
            json={
                "name": "QA Validation Student",
                "email": self.test_student_email,
                "password": self.test_student_password,
                "role": "student",
                "studentId": "STU-QA-2026",
                "verificationToken": v_token,
            },
        )
        assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
        reg_data = reg_res.json()
        assert "user" in reg_data
        assert "accessToken" in reg_data
        user_id = reg_data["user"]["id"]
        assert reg_data["user"]["email"] == self.test_student_email
        assert reg_data["user"]["emailVerified"] is True
        assert reg_data["user"]["verificationStatus"] == "otp_verified"
        assert "password" not in reg_data["user"], "Password leaked in register response!"

        # 3. Login
        login_res = client.post(
            "/api/v1/auth/login",
            json={
                "email": self.test_student_email,
                "password": self.test_student_password,
                "role": "student",
            },
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        login_data = login_res.json()
        student_token = login_data["accessToken"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Session validation
        me_res = client.get("/api/v1/auth/me", headers=student_headers)
        assert me_res.status_code == 200
        assert me_res.json()["id"] == user_id

        # 5. Verify automatic category prediction & 6. Verify priority detection
        triage_res = client.post(
            "/api/v1/ai/classify",
            headers=student_headers,
            json={
                "title": "Severe plumbing pipe burst in hostel 2 washroom",
                "description": "Continuous water flooding corridor on 2nd floor dorm.",
                "location": "Hostel 2, 2nd Floor",
            },
        )
        assert triage_res.status_code == 200
        triage_data = triage_res.json()
        assert triage_data["category"] in ["facilities", "hostel"]
        assert triage_data["priority"] in ["medium", "high", "critical"]
        assert triage_data["urgencyScore"] > 0.4
        assert "modelUsed" in triage_data
        assert "categoryReasons" in triage_data
        assert "priorityReasons" in triage_data

        # 7. Check duplicate suggestions
        dup_res = client.post(
            "/api/v1/ai/detect-duplicates",
            headers=student_headers,
            json={
                "title": "Water pipe leaking in hostel bathroom",
                "description": "Flooding near dorm washrooms.",
                "category": "facilities",
                "location": "Hostel 2",
                "threshold": 0.40,
            },
        )
        assert dup_res.status_code == 200
        dup_data = dup_res.json()
        assert "hasDuplicates" in dup_data
        assert "engine" in dup_data

        # 4. Submit a complaint with an image attachment
        image_data_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        complaint_res = client.post(
            "/api/v1/complaints",
            headers=student_headers,
            json={
                "title": "Severe plumbing pipe burst in hostel 2 washroom",
                "description": "Continuous water flooding corridor on 2nd floor dorm.",
                "category": "facilities",
                "departmentId": "dept-facilities",
                "location": "Hostel 2, 2nd Floor",
                "imageUrl": image_data_uri,
            },
        )
        assert complaint_res.status_code == 201, f"Complaint submission failed: {complaint_res.text}"
        complaint_data = complaint_res.json()
        complaint_id = complaint_data["id"]
        ticket_number = complaint_data["ticket"]
        assert complaint_data["imageUrl"] == image_data_uri, "Image attachment was not saved!"
        assert complaint_data["status"] == "submitted"

        # 8. View complaint history
        history_res = client.get(
            f"/api/v1/complaints?student_id={user_id}",
            headers=student_headers,
        )
        assert history_res.status_code == 200
        user_complaints = history_res.json()
        assert any(c["id"] == complaint_id for c in user_complaints)

        # 9. Track complaint status
        track_res = client.get(f"/api/v1/complaints/{complaint_id}", headers=student_headers)
        assert track_res.status_code == 200
        tracked = track_res.json()
        assert tracked["ticket"] == ticket_number
        assert tracked["status"] == "submitted"
        assert len(tracked["updates"]) >= 1
        assert tracked["imageUrl"] == image_data_uri


class TestPhase5AdminWorkflow:
    """End-to-end validation of complete administrator operations."""

    def test_admin_complete_operations(self, client: TestClient):
        # 1. Login as admin (using seeded admin account password campus123)
        admin_login = client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@campus.edu",
                "password": "campus123",
                "role": "admin",
            },
        )
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_token = admin_login.json()["accessToken"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. View all complaints
        all_comp_res = client.get("/api/v1/complaints", headers=admin_headers)
        assert all_comp_res.status_code == 200
        all_complaints = all_comp_res.json()
        assert len(all_complaints) >= 1
        target_complaint = all_complaints[0]
        cid = target_complaint["id"]

        # 3. Inspect AI classification explanations
        triage_inspect = client.post(
            "/api/v1/ai/classify",
            headers=admin_headers,
            json={
                "title": target_complaint["title"],
                "description": target_complaint["description"],
                "location": target_complaint.get("location"),
            },
        )
        assert triage_inspect.status_code == 200
        inspect_data = triage_inspect.json()
        assert "categoryReasons" in inspect_data
        assert "priorityReasons" in inspect_data
        assert "departmentCode" in inspect_data
        assert "modelUsed" in inspect_data

        # 4. Review duplicate suggestions
        suggested_res = client.get(
            "/api/v1/ai/suggested-duplicates?threshold=0.45",
            headers=admin_headers,
        )
        assert suggested_res.status_code == 200
        suggestions = suggested_res.json()
        assert "suggestedGroups" in suggestions
        assert "totalCandidates" in suggestions

        # 5. Approve duplicate grouping manually (Admin supervision)
        # Create 2 test tickets to group
        c1 = client.post(
            "/api/v1/complaints",
            headers=admin_headers,
            json={
                "title": "QA Grouping Test A - AC down in Lab 1",
                "description": "Air conditioner stopped cooling.",
                "category": "facilities",
                "departmentId": "dept-facilities",
                "location": "Lab 1",
            },
        ).json()
        c2 = client.post(
            "/api/v1/complaints",
            headers=admin_headers,
            json={
                "title": "QA Grouping Test B - AC not cooling in Lab 1",
                "description": "Duct leaking and room warm.",
                "category": "facilities",
                "departmentId": "dept-facilities",
                "location": "Lab 1",
            },
        ).json()

        group_res = client.post(
            "/api/v1/complaints/group",
            headers=admin_headers,
            json={"primaryId": c1["id"], "secondaryId": c2["id"]},
        )
        assert group_res.status_code == 200
        grouped_complaints = group_res.json()
        assert len(grouped_complaints) == 2
        assert grouped_complaints[0]["duplicateGroupId"] is not None
        assert grouped_complaints[0]["duplicateGroupId"] == grouped_complaints[1]["duplicateGroupId"]

        # 6. Change complaint priority
        prio_patch = client.patch(
            f"/api/v1/complaints/{c1['id']}",
            headers=admin_headers,
            json={"priority": "critical", "note": "Elevated by Admin QA review."},
        )
        assert prio_patch.status_code == 200
        assert prio_patch.json()["priority"] == "critical"

        # 7. Update complaint status
        status_patch = client.patch(
            f"/api/v1/complaints/{c1['id']}",
            headers=admin_headers,
            json={"status": "in_progress", "note": "Dispatched technician to inspect AC."},
        )
        assert status_patch.status_code == 200
        assert status_patch.json()["status"] == "in_progress"
        assert len(status_patch.json()["updates"]) >= 2

        # 8. Verify audit logs
        audit_res = client.get("/api/v1/audit-logs", headers=admin_headers)
        assert audit_res.status_code == 200
        audit_logs = audit_res.json()
        assert len(audit_logs) >= 1
        actions = [log["action"] for log in audit_logs]
        assert any(a in ["update_complaint", "group_complaints", "login"] for a in actions)

        # 9. Verify analytics reflect actual database records
        analytics_res = client.get("/api/v1/analytics", headers=admin_headers)
        assert analytics_res.status_code == 200
        analytics = analytics_res.json()
        assert analytics["totalComplaints"] >= len(all_complaints)
        assert "resolvedComplaints" in analytics
        assert "pendingComplaints" in analytics
        assert "criticalComplaints" in analytics
        assert "priorityDistribution" in analytics
        assert "categoryDistribution" in analytics
        assert "departmentDistribution" in analytics
        assert "dailyTrends" in analytics


class TestPhase5SecurityBoundaries:
    """Verifies RBAC enforcement, data isolation, and security hygiene."""

    def test_student_cannot_access_admin_endpoints(self, client: TestClient):
        student_token = create_access_token(
            data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
        )
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Admin user list
        res_users = client.get("/api/v1/users", headers=student_headers)
        assert res_users.status_code == 403

        # Create department
        res_dept = client.post(
            "/api/v1/departments",
            headers=student_headers,
            json={"name": "Hacked Dept", "code": "HCK", "head": "Attacker", "email": "hck@campus.edu"},
        )
        assert res_dept.status_code == 403

        # Suggested duplicates batch
        res_dups = client.get("/api/v1/ai/suggested-duplicates", headers=student_headers)
        assert res_dups.status_code == 403

    def test_unauthenticated_access_rejected(self, client: TestClient):
        # Protected write & admin endpoints must reject unauthenticated requests
        assert client.post("/api/v1/complaints", json={"title": "t", "description": "d"}).status_code == 401
        assert client.patch("/api/v1/complaints/cmp-1", json={"priority": "high"}).status_code == 401
        assert client.get("/api/v1/audit-logs").status_code == 401
        assert client.get("/api/v1/users").status_code == 401
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.post("/api/v1/ai/classify", json={"title": "t", "description": "d"}).status_code == 401

    def test_passwords_never_returned(self, client: TestClient):
        admin_token = create_access_token(
            data={"sub": "admin-sec", "email": "admin@campus.edu", "role": "admin"}
        )
        users = client.get("/api/v1/users", headers={"Authorization": f"Bearer {admin_token}"}).json()
        for u in users:
            assert "password" not in u
            assert "hashed_password" not in u

    def test_cross_student_privacy(self, client: TestClient):
        # Create complaint for user-student
        student_token = create_access_token(
            data={"sub": "user-student", "email": "student@campus.edu", "role": "student"}
        )
        headers = {"Authorization": f"Bearer {student_token}"}
        res = client.get("/api/v1/complaints?student_id=user-student", headers=headers)
        assert res.status_code == 200
        for c in res.json():
            assert c["studentId"] == "user-student"


class TestPhase5AIScenarios:
    """Verifies AI categories, emergency keywords, duplicates, and model provenance."""

    def test_all_seven_categories(self):
        cases = [
            ("Wi-Fi network connection down", "it"),
            ("Leaking water pipe in washroom", "facilities"),
            ("Hostel room mess food cold", "hostel"),
            ("Campus shuttle bus delayed", "transport"),
            ("Exam timetable conflict with quiz", "academics"),
            ("Broken glass and dark alley security hazard", "safety"),
            ("General university feedback", "other"),
        ]
        for title, expected_cat in cases:
            res = DomainHeuristicClassifier.classify(title=title, description=title)
            assert res["category"] == expected_cat, f"Failed on '{title}': expected {expected_cat}, got {res['category']}"

    def test_emergency_hazard_keywords(self):
        emergencies = [
            "Live electrical wire exposed with sparking",
            "Heavy smoke and fire smell from basement",
            "Gas leak near main cafeteria kitchen",
        ]
        for emergency in emergencies:
            res = DomainHeuristicClassifier.classify(title=emergency, description=emergency)
            assert res["priority"] == "critical"
            assert res["urgency_score"] >= 0.90
            assert len(res["priority_reasons"]) > 0

    def test_semantic_duplicate_variations(self):
        # Phrasing variation 1 vs 2
        sim, kws = DuplicateDetector.compute_similarity(
            title_a="Air conditioner broken in library reading room",
            desc_a="The room is warm and study conditions are unbearable.",
            cat_a="facilities",
            loc_a="Central Library",
            title_b="Central library study hall AC cooling failure",
            desc_b="HVAC unit stopped working since morning in library.",
            cat_b="facilities",
            loc_b="Central Library",
        )
        assert sim >= 0.50, f"Expected semantic duplicate detection, got similarity {sim}"

    def test_model_provenance_explicit(self):
        res = DomainHeuristicClassifier.classify("Water leak", "Dripping tap")
        assert "model_used" in res
        assert "rule-based fallback" in res["model_used"]
