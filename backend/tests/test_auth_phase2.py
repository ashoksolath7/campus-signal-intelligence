from datetime import timedelta
import time
from fastapi.testclient import TestClient
import pytest

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, get_password_hash, verify_password
from app.services.auth import find_user_by_email


from tests.conftest import make_verification_token


def test_allowed_email_domain_registration_success(client: TestClient) -> None:
    email = "arjun.das@student.campus.edu"
    v_token = make_verification_token(email)
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Arjun Das",
            "email": email,
            "studentId": "STU-88123",
            "password": "validPassword123",
            "role": "student",
            "verificationToken": v_token,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "arjun.das@student.campus.edu"
    assert data["user"]["role"] == "student"
    assert "password" not in data["user"]


def test_any_email_domain_accepted_with_otp(client: TestClient) -> None:
    diverse_emails = [
        "student@gmail.com",
        "faculty@yahoo.com",
        "staff@outlook.com",
        "scholar@university.edu",
    ]
    for email in diverse_emails:
        v_token = make_verification_token(email)
        sid = f"STU-{int(time.time() * 1000) % 100000}-{email[:4]}"
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Diverse Domain User",
                "email": email,
                "studentId": sid,
                "password": "password123",
                "role": "student",
                "verificationToken": v_token,
            },
        )
        assert response.status_code == 201
        assert response.json()["user"]["email"] == email


def test_duplicate_student_id_registration_fails(client: TestClient) -> None:
    email1 = "first.student@campus.edu"
    email2 = "second.student@campus.edu"
    v1 = make_verification_token(email1)
    v2 = make_verification_token(email2)

    # First student
    res1 = client.post(
        "/api/v1/auth/register",
        json={
            "name": "First Student",
            "email": email1,
            "studentId": "STU-UNIQUE-777",
            "password": "pass123456",
            "role": "student",
            "verificationToken": v1,
        },
    )
    assert res1.status_code == 201

    # Second student attempting same student ID
    res2 = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Second Student",
            "email": email2,
            "studentId": "STU-UNIQUE-777",
            "password": "pass123456",
            "role": "student",
            "verificationToken": v2,
        },
    )
    assert res2.status_code == 409
    error = res2.json()["error"]
    assert error["code"] == "student_id_exists"


def test_password_hashing_security() -> None:
    password = "SuperSecretPassword99"
    hashed = get_password_hash(password)

    # 1. Stored hash is PBKDF2 with 100,000 iterations
    assert hashed.startswith("pbkdf2_sha256$100000$")
    assert password not in hashed

    # 2. Verification works with correct password
    assert verify_password(password, hashed) is True

    # 3. Verification fails with incorrect password
    assert verify_password("WrongPassword123", hashed) is False

    # 4. Verification fails if plaintext password is saved (anti-tamper protection)
    assert verify_password("plaintext", "plaintext") is False
    assert verify_password("", "") is False


def test_jwt_token_claims_and_tampering() -> None:
    token = create_access_token({"sub": "user-test-jwt", "role": "faculty", "email": "test@campus.edu"})
    payload = decode_access_token(token)
    assert payload["sub"] == "user-test-jwt"
    assert payload["role"] == "faculty"
    assert payload["email"] == "test@campus.edu"
    assert "exp" in payload
    assert "iat" in payload

    # Tampered signature must be rejected
    parts = token.split(".")
    tampered_sig = parts[0] + "." + parts[1] + "." + "invalidSignature"
    with pytest.raises(Exception):
        decode_access_token(tampered_sig)

    # Expired token must be rejected
    expired_token = create_access_token(
        {"sub": "user-expired", "role": "student"},
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(Exception):
        decode_access_token(expired_token)


def test_all_demo_roles_login_successfully(client: TestClient) -> None:
    # 1. Student login
    res_student = client.post(
        "/api/v1/auth/login",
        json={"email": "student@campus.edu", "password": "campus123", "role": "student"},
    )
    assert res_student.status_code == 200
    assert res_student.json()["user"]["role"] == "student"

    # 2. Admin login
    res_admin = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@campus.edu", "password": "campus123", "role": "admin"},
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["user"]["role"] == "admin"

    # 3. Faculty login
    res_faculty = client.post(
        "/api/v1/auth/login",
        json={"email": "faculty@campus.edu", "password": "campus123", "role": "faculty"},
    )
    assert res_faculty.status_code == 200
    assert res_faculty.json()["user"]["role"] == "faculty"
    assert res_faculty.json()["user"]["facultyId"] == "FAC-1020"

    # 4. Staff login
    res_staff = client.post(
        "/api/v1/auth/login",
        json={"email": "staff@campus.edu", "password": "campus123", "role": "staff"},
    )
    assert res_staff.status_code == 200
    assert res_staff.json()["user"]["role"] == "staff"
    assert res_staff.json()["user"]["staffId"] == "STF-3010"


def test_role_based_access_control_enforcement(client: TestClient) -> None:
    # Authenticate student
    res_student = client.post(
        "/api/v1/auth/login",
        json={"email": "student@campus.edu", "password": "campus123", "role": "student"},
    )
    student_token = res_student.json()["accessToken"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # Authenticate admin
    res_admin = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@campus.edu", "password": "campus123", "role": "admin"},
    )
    admin_token = res_admin.json()["accessToken"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Student accessing admin-only endpoint: /api/v1/audit-logs
    forbidden_audit = client.get("/api/v1/audit-logs", headers=student_headers)
    assert forbidden_audit.status_code == 403
    assert forbidden_audit.json()["error"]["code"] == "forbidden"

    # Admin accessing /api/v1/audit-logs: allowed
    allowed_audit = client.get("/api/v1/audit-logs", headers=admin_headers)
    assert allowed_audit.status_code == 200

    # 2. Student creating department: /api/v1/departments POST
    forbidden_dept = client.post(
        "/api/v1/departments",
        json={"name": "Forbidden Dept", "code": "FBD", "head": "Head", "email": "fbd@campus.edu"},
        headers=student_headers,
    )
    assert forbidden_dept.status_code == 403

    # 3. Student creating user: /api/v1/users POST
    forbidden_user = client.post(
        "/api/v1/users",
        json={
            "name": "New Person",
            "email": "new.person@campus.edu",
            "password": "password123",
            "role": "student",
        },
        headers=student_headers,
    )
    assert forbidden_user.status_code == 403


def test_email_otp_verification_mechanism(client: TestClient) -> None:
    user_email = "verify.me@campus.edu"

    # Step 1: Send OTP
    send_res = client.post("/api/v1/auth/send-otp", json={"email": user_email})
    assert send_res.status_code == 200

    # User cannot register before verifying OTP
    unverified_reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Verify Me",
            "email": user_email,
            "studentId": "STU-VERIFY-1",
            "password": "password123",
            "role": "student",
        },
    )
    assert unverified_reg.status_code == 403
    assert unverified_reg.json()["error"]["code"] == "email_not_verified"

    # Step 2: Register with signed OTP verification token
    v_token = make_verification_token(user_email)
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Verify Me",
            "email": user_email,
            "studentId": "STU-VERIFY-1",
            "password": "password123",
            "role": "student",
            "verificationToken": v_token,
        },
    )
    assert reg_res.status_code == 201

    # Verify user record
    user_after = find_user_by_email(user_email)
    assert user_after is not None
    assert user_after["email_verified"] is True
    assert user_after["verification_status"] == "otp_verified"
