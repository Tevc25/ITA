import json

import httpx
from fastapi.testclient import TestClient

from app.main import create_app


class _DummyResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self.headers = {"content-type": "application/json"}
        self.content = json.dumps(payload or {"status": "ok"}).encode("utf-8")


def test_system_status_all_up(monkeypatch) -> None:
    async def fake_get(self, url: str, *args, **kwargs):  # noqa: ANN001
        return _DummyResponse(200, {"status": "ok", "url": url})

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/web/system/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert isinstance(payload["services"], list)
    assert any(service["service"] == "gateway-web" and service["up"] for service in payload["services"])


def test_system_status_degraded_when_upstream_unreachable(monkeypatch) -> None:
    async def fake_get(self, url: str, *args, **kwargs):  # noqa: ANN001
        if "gateway-mobile" in url:
            request = httpx.Request("GET", url)
            raise httpx.RequestError("down", request=request)
        return _DummyResponse(200, {"status": "ok"})

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/web/system/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    gateway_mobile_status = next(service for service in payload["services"] if service["service"] == "gateway-mobile")
    assert gateway_mobile_status["up"] is False
