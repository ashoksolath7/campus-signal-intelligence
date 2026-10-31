import concurrent.futures
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.errors import AppError
from app.core.persistence import demo_mode_ctx
from app.database.mongodb import (
    get_next_ticket_number,
    invalidate_ping_cache,
    ping_mongo,
)
from app.database.seed import in_memory_db
from app.services.otp import get_otp_record, verify_registration_otp


def _get_auth_header(client: TestClient, role: str = "student") -> dict[str, str]:
    email = "admin@campus.edu" if role == "admin" else "student@campus.edu"
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "campus123", "role": role},
        headers={"X-Demo-Mode": "true"},
    )
    token = res.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


class TestBackendReliability:
    """Rigorous reliability tests ensuring operations fail safely without MongoDB and never falsely claim persistence."""

    @pytest.fixture(autouse=True)
    def disable_demo_mode_for_reliability(self):
        token = demo_mode_ctx.set(False)
        yield
        demo_mode_ctx.reset(token)

    def test_registration_fails_when_mongodb_unavailable(self, live_client: TestClient) -> None:
        """Registration without demo mode must fail with 503 if MongoDB is disconnected."""
        with patch("app.services.auth._is_mongo_connected", return_value=False):
            with patch("app.services.auth.assert_email_verified", return_value=None):
                with patch("app.core.persistence.ping_mongo", return_value={"status": "disconnected"}):
                    res = live_client.post(
                        "/api/v1/auth/register",
                        json={
                            "name": "Reliability Student",
                            "email": "reliability.student@gmail.com",
                            "password": "Password123!",
                            "studentId": "STU-REL-01",
                            "role": "student",
                        },
                    )
                    assert res.status_code == 503
                    body = res.json()
                    assert body["error"]["code"] in ("database_unavailable", "database_write_failed")

    def test_complaint_creation_fails_when_mongodb_unavailable(self, live_client: TestClient) -> None:
        """Complaint creation without demo mode must fail with 503 if MongoDB is disconnected."""
        auth_header = _get_auth_header(live_client, role="student")
        with patch("app.services.complaints._is_mongo_connected", return_value=False):
            with patch("app.core.persistence.ping_mongo", return_value={"status": "disconnected"}):
                res = live_client.post(
                    "/api/v1/complaints",
                    json={
                        "title": "Broken window in library",
                        "description": "Library window crack near 2nd floor desk.",
                        "category": "facilities",
                        "departmentId": "dept-facilities",
                        "location": "Library Floor 2",
                    },
                    headers=auth_header,
                )
                assert res.status_code == 503
                body = res.json()
                assert body["error"]["code"] == "database_unavailable"

    def test_complaint_update_fails_when_mongodb_unavailable(self, live_client: TestClient) -> None:
        """Complaint status update without demo mode must fail with 503 if MongoDB is disconnected."""
        auth_header = _get_auth_header(live_client, role="admin")
        with patch("app.services.complaints._is_mongo_connected", return_value=False):
            with patch("app.core.persistence.ping_mongo", return_value={"status": "disconnected"}):
                res = live_client.patch(
                    "/api/v1/complaints/cmp-facilities-01",
                    json={"status": "in_progress", "note": "Technician dispatched"},
                    headers=auth_header,
                )
                assert res.status_code == 503
                assert res.json()["error"]["code"] == "database_unavailable"

    def test_duplicate_grouping_fails_when_mongodb_unavailable(self, live_client: TestClient) -> None:
        """Approving duplicate groups must fail safely with 503 if MongoDB is disconnected."""
        auth_header = _get_auth_header(live_client, role="admin")
        with patch("app.services.complaints._is_mongo_connected", return_value=False):
            with patch("app.core.persistence.ping_mongo", return_value={"status": "disconnected"}):
                res = live_client.post(
                    "/api/v1/complaints/group",
                    json={"primaryId": "cmp-facilities-01", "secondaryId": "cmp-facilities-02"},
                    headers=auth_header,
                )
                assert res.status_code == 503
                assert res.json()["error"]["code"] == "database_unavailable"

    def test_admin_department_creation_fails_when_mongodb_unavailable(self, live_client: TestClient) -> None:
        """Admin creating a department must fail safely with 503 if MongoDB is disconnected."""
        auth_header = _get_auth_header(live_client, role="admin")
        with patch("app.services.departments._is_mongo_connected", return_value=False):
            with patch("app.core.persistence.ping_mongo", return_value={"status": "disconnected"}):
                res = live_client.post(
                    "/api/v1/departments",
                    json={
                        "name": "New Research Wing",
                        "code": "NRW",
                        "head": "Dr. Alan",
                        "email": "nrw@campus.edu",
                    },
                    headers=auth_header,
                )
                assert res.status_code == 503
                assert res.json()["error"]["code"] == "database_unavailable"

    def test_admin_user_creation_fails_when_mongodb_unavailable(self, live_client: TestClient) -> None:
        """Admin creating a user must fail safely with 503 if MongoDB is disconnected."""
        auth_header = _get_auth_header(live_client, role="admin")
        with patch("app.services.users._is_mongo_connected", return_value=False):
            with patch("app.core.persistence.ping_mongo", return_value={"status": "disconnected"}):
                res = live_client.post(
                    "/api/v1/users",
                    json={
                        "name": "Admin Created User",
                        "email": "admin.created@campus.edu",
                        "password": "Password123!",
                        "role": "staff",
                    },
                    headers=auth_header,
                )
                assert res.status_code == 503
                assert res.json()["error"]["code"] == "database_unavailable"

    def test_otp_persistence_fails_when_mongodb_unavailable_in_production(self, live_client: TestClient) -> None:
        """In production environment, OTP sending must fail with 503 if MongoDB is unreachable."""
        with patch.object(settings, "app_env", "production"):
            with patch("app.services.otp._is_mongo_connected", return_value=False):
                with patch("app.core.persistence.ping_mongo", return_value={"status": "disconnected"}):
                    res = live_client.post(
                        "/api/v1/auth/send-otp",
                        json={"email": "prod.student@gmail.com"},
                    )
                    assert res.status_code == 503
                    assert res.json()["error"]["code"] == "database_unavailable"

    def test_otp_verification_rejects_unpersisted_otp_in_production(self) -> None:
        """In production, verify_otp cannot succeed using an unpersisted record in in_memory_db."""
        unpersisted_email = "unpersisted.student@gmail.com"
        in_memory_db["email_otps"][unpersisted_email] = {
            "email": unpersisted_email,
            "hashed_otp": "bogus_hash",
            "attempts": 0,
        }

        with patch.object(settings, "app_env", "production"):
            with patch("app.services.otp._is_mongo_connected", return_value=True):
                with patch("app.core.persistence.ping_mongo", return_value={"status": "connected"}):
                    with patch("app.database.mongodb.ping_mongo", return_value={"status": "connected"}):
                        # Mock MongoDB find_one returning None (record was NOT persisted in Atlas)
                        mock_col = MagicMock()
                        mock_col.find_one.return_value = None
                        with patch("app.services.otp._get_otps_collection", return_value=mock_col):
                            with pytest.raises(AppError) as exc_info:
                                verify_registration_otp(unpersisted_email, "123456")
                            assert exc_info.value.code == "otp_not_found"

    def test_atomic_ticket_id_generation_concurrency(self) -> None:
        """Concurrent requests generating tickets must produce strictly unique, collision-free numbers."""
        allocated_tickets = []

        def allocate():
            # Test concurrent generation in demo/thread-safe mode
            ticket = get_next_ticket_number(is_demo=True)
            return ticket

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(allocate) for _ in range(30)]
            for f in concurrent.futures.as_completed(futures):
                allocated_tickets.append(f.result())

        assert len(allocated_tickets) == 30
        assert len(set(allocated_tickets)) == 30, "Collision detected in ticket IDs!"

        # Verify all tickets start with CSI-
        for t in allocated_tickets:
            assert t.startswith("CSI-")

    def test_15s_cache_invalidation_on_write_failure(self) -> None:
        """When a write failure occurs, invalidate_ping_cache(disconnected=True) immediately marks status disconnected."""
        invalidate_ping_cache(disconnected=True)
        status = ping_mongo()
        assert status["status"] == "disconnected"

    def test_15s_cache_recovery_after_disconnect(self) -> None:
        """When MongoDB recovers, force=True or cache TTL expiration returns connected."""
        with patch("app.database.mongodb.get_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client[settings.mongodb_db_name].command.return_value = {"ok": 1.0}
            mock_get_client.return_value = mock_client

            invalidate_ping_cache(disconnected=False)
            status = ping_mongo(force=True)
            assert status["status"] == "connected"

    def test_cache_concurrency_safety(self) -> None:
        """Concurrent calls to ping_mongo do not corrupt state or raise exceptions."""
        results = []

        def call_ping():
            return ping_mongo()

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(call_ping) for _ in range(25)]
            for f in concurrent.futures.as_completed(futures):
                results.append(f.result())

        assert len(results) == 25
        for r in results:
            assert isinstance(r, dict)
            assert "status" in r
