from fastapi.testclient import TestClient


def _get_auth_header(client: TestClient, role: str = "student") -> dict[str, str]:
    email = "admin@campus.edu" if role == "admin" else "student@campus.edu"
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "campus123", "role": role},
    )
    token = res.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_list_complaints(client: TestClient) -> None:
    res = client.get("/api/v1/complaints")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) > 0
    assert "ticket" in items[0]
    assert "category" in items[0]


def test_complaint_filtering_and_search(client: TestClient) -> None:
    # Filter by category
    res_cat = client.get("/api/v1/complaints?category=facilities")
    assert res_cat.status_code == 200
    for c in res_cat.json():
        assert c["category"] == "facilities"

    # Search query
    res_q = client.get("/api/v1/complaints?query=Library")
    assert res_q.status_code == 200
    assert len(res_q.json()) > 0


def test_create_complaint_lifecycle(client: TestClient) -> None:
    headers = _get_auth_header(client, role="student")
    payload = {
        "title": "Broken elevator in Main Building",
        "description": "The west elevator has been stopped between floor 1 and 2.",
        "category": "facilities",
        "departmentId": "dept-facilities",
        "location": "Main Building West Wing",
    }
    create_res = client.post("/api/v1/complaints", json=payload, headers=headers)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["title"] == payload["title"]
    assert created["status"] == "submitted"
    assert created["priority"] == "medium"
    assert created["ticket"].startswith("CSI-")
    assert len(created["updates"]) == 1
    assert created["updates"][0]["status"] == "submitted"

    cid = created["id"]

    # Fetch details
    detail_res = client.get(f"/api/v1/complaints/{cid}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == cid

    # Update workflow as Admin
    admin_headers = _get_auth_header(client, role="admin")
    patch_res = client.patch(
        f"/api/v1/complaints/{cid}",
        json={"status": "in_progress", "priority": "high", "note": "Elevator technicians dispatched."},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "in_progress"
    assert updated["priority"] == "high"
    assert len(updated["updates"]) == 2
    assert updated["updates"][1]["status"] == "in_progress"
    assert "technicians" in updated["updates"][1]["note"]


def test_group_duplicate_complaints(client: TestClient) -> None:
    admin_headers = _get_auth_header(client, role="admin")
    group_res = client.post(
        "/api/v1/complaints/group",
        json={"primaryId": "cmp-1", "secondaryId": "cmp-2"},
        headers=admin_headers,
    )
    assert group_res.status_code == 200
    items = group_res.json()
    assert len(items) == 2
    assert items[0]["duplicateGroupId"] is not None
    assert items[0]["duplicateGroupId"] == items[1]["duplicateGroupId"]


def test_departments_crud(client: TestClient) -> None:
    # List
    list_res = client.get("/api/v1/departments")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 6

    # Create (Admin only)
    admin_headers = _get_auth_header(client, role="admin")
    new_dept = {
        "name": "Health Center",
        "code": "HLT",
        "head": "Dr. Sarah Khan",
        "email": "health@campus.edu",
        "active": True,
    }
    create_res = client.post("/api/v1/departments", json=new_dept, headers=admin_headers)
    assert create_res.status_code == 201
    created_dept = create_res.json()
    assert created_dept["code"] == "HLT"

    # Patch active toggle
    patch_res = client.patch(
        f"/api/v1/departments/{created_dept['id']}",
        json={"active": False},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["active"] is False


def test_users_crud(client: TestClient) -> None:
    admin_headers = _get_auth_header(client, role="admin")

    # List users
    list_res = client.get("/api/v1/users", headers=admin_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 4

    # Create user
    new_user = {
        "name": "Staff Officer",
        "email": "staff.officer@campus.edu",
        "password": "staffpassword123",
        "role": "admin",
        "departmentId": "dept-facilities",
    }
    create_res = client.post("/api/v1/users", json=new_user, headers=admin_headers)
    assert create_res.status_code == 201
    created_user = create_res.json()
    assert created_user["email"] == "staff.officer@campus.edu"

    # Patch user
    patch_res = client.patch(
        f"/api/v1/users/{created_user['id']}",
        json={"phone": "999-888-7777"},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["phone"] == "999-888-7777"


def test_analytics_summary(client: TestClient) -> None:
    headers = _get_auth_header(client, role="student")
    res = client.get("/api/v1/analytics", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "totalComplaints" in data
    assert "pendingComplaints" in data
    assert "resolvedComplaints" in data
    assert "criticalComplaints" in data
    assert isinstance(data["categoryDistribution"], list)
    assert isinstance(data["priorityDistribution"], list)
    assert isinstance(data["departmentDistribution"], list)
    assert isinstance(data["dailyTrends"], list)


def test_audit_logs(client: TestClient) -> None:
    admin_headers = _get_auth_header(client, role="admin")
    res = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    assert "action" in logs[0]
    assert "actor" in logs[0]

