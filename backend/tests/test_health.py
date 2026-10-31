from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "campus-signal-intelligence-api"
    assert "mongodb" in body
    assert body["mongodb"]["status"] in {"connected", "disconnected", "not_configured"}
    assert body["mongodb"]["database"] == "campus_signal_db"
    assert "configured" in body["mongodb"]
    serialized = str(body["mongodb"]).lower()
    assert "mongodb+srv" not in serialized
    assert "mongodb://" not in serialized


def test_root_points_to_docs(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_openapi_is_available(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    body = response.json()
    assert body["info"]["title"] == "Campus Signal Intelligence"
    assert "/api/v1/health" in body["paths"]


def test_cors_headers_for_localhost_and_127_0_0_1(client: TestClient) -> None:
    # Test GET from localhost:5173
    res_localhost = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert res_localhost.status_code == 200
    assert res_localhost.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res_localhost.headers.get("access-control-allow-credentials") == "true"

    # Test GET from 127.0.0.1:5173
    res_ip = client.get("/api/v1/health", headers={"Origin": "http://127.0.0.1:5173"})
    assert res_ip.status_code == 200
    assert res_ip.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"

    # Test Private Network Access preflight from localhost:5173
    preflight = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert preflight.headers.get("access-control-allow-private-network") == "true"
