from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi.testclient import TestClient
import pytest

from app.core.config import settings
from app.services.auth import find_user_by_email
from app.services.otp import (
    generate_secure_otp,
    get_otp_record,
    hash_otp,
    save_otp_record,
)


@pytest.fixture(autouse=True)
def mock_smtp_delivery():
    """Mock SMTP email delivery so tests never send actual external network emails."""
    with patch("app.services.otp.send_otp_email") as mock_send:
        # Default mock returns delivery success dict
        mock_send.side_effect = lambda to_email, otp: {
            "delivered": True,
            "method": "mock_smtp_test",
            "message": f"Dispatched OTP {otp} to {to_email}",
        }
        yield mock_send


def test_any_email_domain_accepted_for_otp(client: TestClient, mock_smtp_delivery):
    """Verifies that campus email restrictions are removed and any valid email domain is accepted."""
    test_emails = [
        "student.gmail@gmail.com",
        "researcher.yahoo@yahoo.com",
        "faculty.outlook@outlook.com",
        "campus.user@university.ac.in",
        "custom.corp@mycompany.org",
    ]

    for email in test_emails:
        res = client.post("/api/v1/auth/send-otp", json={"email": email})
        assert res.status_code == 200, f"Failed for email: {email}, error: {res.text}"
        data = res.json()
        assert data["email"] == email.lower()
        assert data["cooldownSeconds"] == settings.otp_resend_cooldown_seconds
        assert data["expiresInSeconds"] == settings.otp_expire_minutes * 60
        assert "Verification code sent" in data["message"]


def test_invalid_email_syntax_rejected(client: TestClient):
    """Verifies that invalid email syntax is rejected with 400 Bad Request."""
    invalid_emails = [
        "not-an-email",
        "missingatsign.com",
        "@missingusername.com",
        "spaces in@domain.com",
        "",
    ]
    for email in invalid_emails:
        res = client.post("/api/v1/auth/send-otp", json={"email": email})
        assert res.status_code in (400, 422), f"Expected 400/422 for '{email}', got {res.status_code}"


def test_otp_is_cryptographically_secure_6_digits():
    """Verifies that generate_secure_otp always produces 6 numeric digits."""
    for _ in range(50):
        code = generate_secure_otp()
        assert len(code) == 6
        assert code.isdigit()


def test_otp_stored_hashed_never_plaintext(client: TestClient, mock_smtp_delivery):
    """Verifies requirement 10: Store only hashed OTP values, never plaintext."""
    email = "security.audit@gmail.com"
    res = client.post("/api/v1/auth/send-otp", json={"email": email})
    assert res.status_code == 200

    # Retrieve record from database/memory
    record = get_otp_record(email)
    assert record is not None
    assert "hashed_otp" in record
    assert "otp" not in record, "Raw plaintext OTP must NEVER be stored in the database record!"

    # Ensure hash matches salted hash
    captured_call = mock_smtp_delivery.call_args
    sent_otp = captured_call.kwargs["otp"] if "otp" in captured_call.kwargs else captured_call[1]["otp"]
    expected_hash = hash_otp(email, sent_otp)
    assert record["hashed_otp"] == expected_hash


def test_no_permanent_account_created_before_otp_verification(client: TestClient, mock_smtp_delivery):
    """Verifies requirement 8: Do not create permanent user accounts before successful OTP verification."""
    email = "unverified.user@gmail.com"

    # Step 1: Send OTP
    client.post("/api/v1/auth/send-otp", json={"email": email})

    # Assert no user exists in database
    assert find_user_by_email(email) is None

    # Step 2: Attempt registration without verification
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Unverified User",
            "email": email,
            "studentId": "STU-UNVERIFIED-1",
            "password": "Password123!",
            "role": "student",
        },
    )
    assert reg_res.status_code == 403
    assert reg_res.json()["error"]["code"] == "email_not_verified"

    # Verify user STILL does not exist
    assert find_user_by_email(email) is None


def test_otp_resend_cooldown_60_seconds(client: TestClient, mock_smtp_delivery):
    """Verifies requirement 9: 60-second resend cooldown returns 429."""
    email = "cooldown.test@gmail.com"

    # First request succeeds
    res1 = client.post("/api/v1/auth/send-otp", json={"email": email})
    assert res1.status_code == 200

    # Immediate second request fails with 429
    res2 = client.post("/api/v1/auth/send-otp", json={"email": email})
    assert res2.status_code == 429
    err = res2.json()["error"]
    assert err["code"] == "otp_cooldown"
    assert "seconds before requesting a new verification code" in err["message"]


def test_otp_max_5_incorrect_attempts_exceeded(client: TestClient, mock_smtp_delivery):
    """Verifies requirement 9: Maximum 5 incorrect attempts before lockout/invalidation."""
    email = "attempts.test@gmail.com"

    client.post("/api/v1/auth/send-otp", json={"email": email})

    # 4 incorrect attempts return 400 with attempts remaining
    for i in range(1, 5):
        bad_res = client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": "999999"})
        assert bad_res.status_code == 400
        assert "attempt(s) remaining" in bad_res.json()["error"]["message"]

    # 5th incorrect attempt exceeds max attempts and returns 429
    fifth_res = client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": "999999"})
    assert fifth_res.status_code == 429
    assert fifth_res.json()["error"]["code"] == "max_attempts_exceeded"

    # Subsequent attempt indicates code expired or not found
    after_res = client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": "999999"})
    assert after_res.status_code in (404, 429)


def test_otp_expires_after_5_minutes(client: TestClient, mock_smtp_delivery):
    """Verifies requirement 9: OTP expires after 5 minutes."""
    email = "expiry.test@gmail.com"
    client.post("/api/v1/auth/send-otp", json={"email": email})

    # Manipulate record to be expired 6 minutes ago
    record = get_otp_record(email)
    assert record is not None
    expired_time = datetime.now(timezone.utc) - timedelta(minutes=6)
    record["expires_at"] = expired_time.isoformat()
    save_otp_record(record)

    # Attempt verification with any OTP
    verify_res = client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": "123456"})
    assert verify_res.status_code == 400
    assert verify_res.json()["error"]["code"] == "otp_expired"


def test_full_otp_registration_lifecycle(client: TestClient, mock_smtp_delivery):
    """Verifies complete end-to-end flow: send OTP -> verify OTP -> complete registration."""
    email = "complete.student@gmail.com"
    password = "SecurePassword123!"

    # 1. Send OTP
    send_res = client.post("/api/v1/auth/send-otp", json={"email": email})
    assert send_res.status_code == 200

    # Extract sent OTP from mocked SMTP call
    captured_call = mock_smtp_delivery.call_args
    sent_otp = captured_call.kwargs.get("otp") or captured_call[1]["otp"]

    # 2. Verify OTP
    verify_res = client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": sent_otp})
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["verified"] is True
    assert "verificationToken" in verify_data
    token = verify_data["verificationToken"]

    # 3. Complete registration with verification token
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Complete Student",
            "email": email,
            "studentId": "STU-COMPLETE-99",
            "password": password,
            "role": "student",
            "verificationToken": token,
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["user"]["email"] == email
    assert reg_data["user"]["emailVerified"] is True
    assert reg_data["user"]["verificationStatus"] == "otp_verified"
    assert "accessToken" in reg_data

    # 4. Attempt login with new credentials
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "role": "student"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["email"] == email


def test_prototype_verification_endpoint_removed(client: TestClient):
    """Verifies requirement 11: Remove the existing simulated/prototype email verification."""
    res = client.post(
        "/api/v1/auth/prototype-verify-email",
        json={"email": "test@campus.edu", "prototypeCode": "000000"},
    )
    assert res.status_code == 404


def test_failed_email_delivery_does_not_leave_unusable_otp_or_block_retry(client: TestClient, monkeypatch):
    """Verifies requirement 9: Failed email delivery does not leave an unusable OTP record or block retry."""
    email = "delivery.fail.test@gmail.com"

    # Simulate SMTP failure
    from app.core.errors import AppError
    def failing_send(to_email, otp):
        raise AppError("Connection timed out", code="smtp_connection_timeout", status_code=504)

    monkeypatch.setattr("app.services.otp.send_otp_email", failing_send)

    # 1. Attempt sending OTP - fails
    res_fail = client.post("/api/v1/auth/send-otp", json={"email": email})
    assert res_fail.status_code == 504
    assert res_fail.json()["error"]["code"] == "smtp_connection_timeout"

    # 2. Check database - no unusable record remains
    rec = get_otp_record(email)
    assert rec is None, "Failed email delivery must NOT leave an unusable OTP record in DB!"

    # 3. Simulate recovery - immediate retry should NOT be blocked by 60s cooldown
    def working_send(to_email, otp):
        return {"delivered": True, "method": "mock_smtp_test"}

    monkeypatch.setattr("app.services.otp.send_otp_email", working_send)
    res_retry = client.post("/api/v1/auth/send-otp", json={"email": email})
    assert res_retry.status_code == 200, "Immediate retry after failed delivery must succeed without cooldown lock!"


def test_smtp_safe_error_messages(client: TestClient, monkeypatch):
    """Verifies requirement 5 & 7: Safe, informative error messages without credential leakage."""
    import socket
    import smtplib
    from app.core.errors import AppError
    from app.services.email import send_otp_email

    # Test authentication failure
    class MockAuthFailSMTP:
        def __init__(self, *args, **kwargs):
            pass
        def starttls(self):
            pass
        def login(self, user, pwd):
            raise smtplib.SMTPAuthenticationError(535, b"Invalid credentials")
        def close(self):
            pass

    monkeypatch.setattr(smtplib, "SMTP", MockAuthFailSMTP)

    with pytest.raises(AppError) as exc_info:
        send_otp_email("test@example.com", "123456")
    err = exc_info.value
    assert err.status_code == 502
    assert err.code == "smtp_auth_failed"
    assert "authentication rejected" in err.message.lower()
    assert "pwkuniowtzubpgsq" not in err.message  # Never leak password!

    # Test connection timeout
    class MockTimeoutSMTP:
        def __init__(self, *args, **kwargs):
            raise socket.timeout("timed out")
        def close(self):
            pass

    monkeypatch.setattr(smtplib, "SMTP", MockTimeoutSMTP)

    with pytest.raises(AppError) as exc_info2:
        send_otp_email("test@example.com", "123456")
    err2 = exc_info2.value
    assert err2.status_code == 504
    assert err2.code == "smtp_connection_timeout"
    assert "timed out" in err2.message.lower()


