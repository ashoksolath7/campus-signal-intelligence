from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.core.persistence import demo_mode_ctx
from app.core.security import create_access_token
from app.main import app


@pytest.fixture(autouse=True)
def enable_test_demo_mode():
    """Default unit tests to authorized test demo fallback mode unless explicitly testing live/prod."""
    token = demo_mode_ctx.set(True)
    yield
    demo_mode_ctx.reset(token)


@pytest.fixture(autouse=True)
def mock_smtp_delivery():
    """Mock SMTP email delivery so tests never send actual external network emails."""
    with patch("app.services.otp.send_otp_email") as mock1, patch("app.services.email.send_otp_email") as mock2:
        mock_result = {
            "delivered": True,
            "method": "mock_smtp_test",
            "message": "Mock email dispatched successfully in test environment",
        }
        mock1.side_effect = lambda to_email, otp: mock_result
        mock2.side_effect = lambda to_email, otp: mock_result
        yield mock1


@pytest.fixture
def client() -> TestClient:
    with TestClient(app, headers={"X-Demo-Mode": "true"}) as test_client:
        yield test_client


@pytest.fixture
def live_client() -> TestClient:
    """Test client without demo headers to test persistent production requirements."""
    with TestClient(app) as test_client:
        yield test_client


def make_verification_token(email: str) -> str:
    """Helper for testing to generate a signed OTP verification token."""
    from datetime import timedelta
    return create_access_token(
        data={"sub": email.strip().lower(), "type": "otp_verified", "purpose": "registration"},
        expires_delta=timedelta(minutes=15),
    )
