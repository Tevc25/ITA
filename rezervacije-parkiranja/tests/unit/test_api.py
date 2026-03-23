from datetime import timedelta

from fastapi.testclient import TestClient

from app.infrastruktura.config import Settings
from app.main import create_app
from app.domena.reservation import utc_now



def _build_payload(offset_hours: int = 1) -> dict:
    start = utc_now() + timedelta(hours=offset_hours)
    end = start + timedelta(hours=2)
    return {
        "user_id": "api-user-1",
        "parking_lot_id": "api-lot-1",
        "vehicle_plate": "LJ-API-123",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }



def test_openapi_endpoint_is_available(tmp_path) -> None:
    db_path = tmp_path / "api-openapi.db"
    settings = Settings(
        database_url=f"sqlite+aiosqlite:///{db_path}",
        broker_enabled=False,
        broker_required=False,
        log_level="CRITICAL",
    )
    app = create_app(settings)

    with TestClient(app) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/reservations" in response.json()["paths"]



def test_create_cancel_and_filter_reservations(tmp_path) -> None:
    db_path = tmp_path / "api-functional.db"
    settings = Settings(
        database_url=f"sqlite+aiosqlite:///{db_path}",
        broker_enabled=False,
        broker_required=False,
        log_level="CRITICAL",
    )
    app = create_app(settings)

    with TestClient(app) as client:
        create_response = client.post("/api/v1/reservations", json=_build_payload())
        assert create_response.status_code == 201
        reservation = create_response.json()
        reservation_id = reservation["id"]

        get_response = client.get(f"/api/v1/reservations/{reservation_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == reservation_id

        active_response = client.get("/api/v1/users/api-user-1/reservations?scope=active")
        assert active_response.status_code == 200
        assert len(active_response.json()) == 1

        cancel_response = client.post(
            f"/api/v1/reservations/{reservation_id}/cancel",
            json={"user_id": "api-user-1"},
        )
        assert cancel_response.status_code == 200
        assert cancel_response.json()["status"] == "cancelled"

        active_after_cancel = client.get("/api/v1/users/api-user-1/reservations?scope=active")
        assert active_after_cancel.status_code == 200
        assert active_after_cancel.json() == []

        past_response = client.get("/api/v1/users/api-user-1/reservations?scope=past")
        assert past_response.status_code == 200
        assert len(past_response.json()) == 1



def test_overlap_returns_conflict(tmp_path) -> None:
    db_path = tmp_path / "api-overlap.db"
    settings = Settings(
        database_url=f"sqlite+aiosqlite:///{db_path}",
        broker_enabled=False,
        broker_required=False,
        log_level="CRITICAL",
    )
    app = create_app(settings)

    with TestClient(app) as client:
        first = _build_payload(offset_hours=4)
        second = _build_payload(offset_hours=5)
        second["start_time"] = first["start_time"]

        first_response = client.post("/api/v1/reservations", json=first)
        assert first_response.status_code == 201

        overlap_response = client.post("/api/v1/reservations", json=second)
        assert overlap_response.status_code == 409
