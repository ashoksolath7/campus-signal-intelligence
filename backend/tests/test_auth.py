from fastapi.testclient import TestClient


def test_student_login_success(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "student@campus.edu",
            "password": "campus123",
            "role": "student",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "accessToken" in data
    assert data["tokenType"] == "bearer"
    assert data["user"]["email"] == "student@campus.edu"
    assert data["user"]["role"] == "student"
    assert data["user"]["studentId"] == "STU-20418"
    assert "password" not in data["user"]


def test_admin_login_success(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "admin@campus.edu",
            "password": "campus123",
            "role": "admin",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "accessToken" in data
    assert data["user"]["role"] == "admin"
    assert data["user"]["departmentId"] == "dept-academic"


def test_login_invalid_password(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "student@campus.edu",
            "password": "wrongpassword",
            "role": "student",
        },
    )
    assert response.status_code == 401
    error = response.json()["error"]
    assert error["code"] == "invalid_credentials"


def test_login_role_mismatch(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "student@campus.edu",
            "password": "campus123",
            "role": "admin",
        },
    )
    assert response.status_code == 403
    error = response.json()["error"]
    assert error["code"] == "role_mismatch"


def test_student_registration_and_me(client: TestClient) -> None:
    from tests.conftest import make_verification_token
    user_email = "pooja.sharma@campus.edu"
    v_token = make_verification_token(user_email)
    reg_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Pooja Sharma",
            "email": user_email,
            "studentId": "STU-33211",
            "password": "securepass123",
            "verificationToken": v_token,
        },
    )
    assert reg_response.status_code == 201
    reg_data = reg_response.json()
    token = reg_data["accessToken"]
    assert token
    assert reg_data["user"]["name"] == "Pooja Sharma"
    assert reg_data["user"]["studentId"] == "STU-33211"

    # Test GET /auth/me with Bearer token
    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["email"] == "pooja.sharma@campus.edu"
    assert me_data["studentId"] == "STU-33211"


def test_duplicate_registration_fails(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Duplicate Student",
            "email": "student@campus.edu",
            "studentId": "STU-99999",
            "password": "password123",
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "user_exists"


def test_me_unauthorized_without_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_me_invalid_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not.a.valid.jwt"},
    )
    assert response.status_code == 401

