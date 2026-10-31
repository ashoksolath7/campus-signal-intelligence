import time
from fastapi.testclient import TestClient

from app.schemas.user import UserRole
from tests.conftest import make_verification_token


def test_complete_frontend_backend_lifecycle(client: TestClient) -> None:
    # 1. Student Registration via verified OTP token
    timestamp = int(time.time() * 1000) % 1000000
    student_email = f"student.flow.{timestamp}@student.campus.edu"
    student_id = f"STU-FLOW-{timestamp}"
    v_token = make_verification_token(student_email)

    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Integration Student",
            "email": student_email,
            "studentId": student_id,
            "password": "Password123!",
            "role": "student",
            "verificationToken": v_token,
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    student_token = reg_data["accessToken"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    assert reg_data["user"]["email"] == student_email
    assert reg_data["user"]["role"] == "student"

    # 2. Login verification for all four roles
    login_roles: list[tuple[str, str, str]] = [
        ("student@campus.edu", "campus123", "student"),
        ("faculty@campus.edu", "campus123", "faculty"),
        ("staff@campus.edu", "campus123", "staff"),
        ("admin@campus.edu", "campus123", "admin"),
    ]
    for email, pwd, role in login_roles:
        res = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": pwd, "role": role},
        )
        assert res.status_code == 200
        assert res.json()["user"]["role"] == role
        assert "accessToken" in res.json()

    # Admin auth headers
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@campus.edu", "password": "campus123", "role": "admin"},
    )
    admin_token = admin_login.json()["accessToken"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Staff auth headers
    staff_login = client.post(
        "/api/v1/auth/login",
        json={"email": "staff@campus.edu", "password": "campus123", "role": "staff"},
    )
    staff_token = staff_login.json()["accessToken"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 3. Student Complaint Submission
    complaint_payload = {
        "title": "Air quality alert in Chemistry Lab 3",
        "description": "Fume hood alarm is beeping and exhaust fan stopped working.",
        "category": "facilities",
        "departmentId": "dept-facilities",
        "location": "Science Wing, Chem Lab 3",
    }
    comp_res = client.post(
        "/api/v1/complaints",
        json=complaint_payload,
        headers=student_headers,
    )
    assert comp_res.status_code == 201
    created_comp = comp_res.json()
    cid = created_comp["id"]
    ticket = created_comp["ticket"]
    assert ticket.startswith("CSI-")
    assert created_comp["status"] == "submitted"
    assert created_comp["priority"] == "medium"
    assert created_comp["studentEmail"] == student_email
    assert len(created_comp["updates"]) == 1

    # 4. Complaint Listing and Filtering
    list_res = client.get("/api/v1/complaints", headers=student_headers)
    assert list_res.status_code == 200
    all_tickets = list_res.json()
    assert any(c["id"] == cid for c in all_tickets)

    # Search filter
    search_res = client.get(
        "/api/v1/complaints?query=Chemistry",
        headers=student_headers,
    )
    assert search_res.status_code == 200
    assert any(c["id"] == cid for c in search_res.json())

    # 5. Detail Retrieval
    detail_res = client.get(f"/api/v1/complaints/{cid}", headers=student_headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == cid
    assert detail_res.json()["ticket"] == ticket

    # 6. Admin / Staff Complaint Workflow Management
    patch_res = client.patch(
        f"/api/v1/complaints/{cid}",
        json={
            "status": "in_progress",
            "priority": "critical",
            "note": "Safety inspector dispatched immediately.",
        },
        headers=staff_headers,
    )
    assert patch_res.status_code == 200
    updated_comp = patch_res.json()
    assert updated_comp["status"] == "in_progress"
    assert updated_comp["priority"] == "critical"
    assert len(updated_comp["updates"]) == 2
    assert updated_comp["updates"][1]["status"] == "in_progress"
    assert "Safety inspector" in updated_comp["updates"][1]["note"]

    # 7. Grouping Duplicate Tickets
    group_res = client.post(
        "/api/v1/complaints/group",
        json={"primaryId": "cmp-1", "secondaryId": cid},
        headers=admin_headers,
    )
    assert group_res.status_code == 200
    grouped = group_res.json()
    assert len(grouped) == 2
    assert grouped[0]["duplicateGroupId"] is not None
    assert grouped[0]["duplicateGroupId"] == grouped[1]["duplicateGroupId"]

    # 8. Real Analytics API
    analytics_res = client.get("/api/v1/analytics", headers=admin_headers)
    assert analytics_res.status_code == 200
    analytics_data = analytics_res.json()
    assert analytics_data["totalComplaints"] >= 4
    assert analytics_data["pendingComplaints"] >= 1
    assert isinstance(analytics_data["categoryDistribution"], list)
    assert isinstance(analytics_data["priorityDistribution"], list)
    assert isinstance(analytics_data["departmentDistribution"], list)

    # 9. Role-Based Permission Boundaries
    # Staff attempting admin-only user creation -> must be 403
    staff_user_create = client.post(
        "/api/v1/users",
        json={
            "name": "Staff Added User",
            "email": "staff.added@campus.edu",
            "password": "Password123",
            "role": "student",
        },
        headers=staff_headers,
    )
    assert staff_user_create.status_code == 403

    # Student attempting admin-only department creation -> must be 403
    student_dept_create = client.post(
        "/api/v1/departments",
        json={
            "name": "Student Dept",
            "code": "STU",
            "head": "Student Head",
            "email": "studept@campus.edu",
        },
        headers=student_headers,
    )
    assert student_dept_create.status_code == 403

    # Admin creating department -> succeeds (201)
    admin_dept_create = client.post(
        "/api/v1/departments",
        json={
            "name": f"Robotics Lab {timestamp}",
            "code": f"ROB{timestamp % 1000}",
            "head": "Dr. Alan Turing",
            "email": f"robotics.{timestamp}@campus.edu",
        },
        headers=admin_headers,
    )
    assert admin_dept_create.status_code == 201

    # Student accessing audit logs -> must be 403
    student_audit = client.get("/api/v1/audit-logs", headers=student_headers)
    assert student_audit.status_code == 403

    # Admin accessing audit logs -> succeeds (200)
    admin_audit = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert admin_audit.status_code == 200
    assert len(admin_audit.json()) > 0

