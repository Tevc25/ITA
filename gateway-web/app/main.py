from __future__ import annotations

from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException, Query, Request, Response, status

from app.config import Settings, get_settings



def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()

    app = FastAPI(
        title="Gateway Web API",
        version="1.0.0",
        description="API Gateway za spletni odjemalec (web).",
    )

    async def _forward(
        method: str,
        base_url: str,
        path: str,
        *,
        body: Any | None = None,
        params: dict | None = None,
        auth_header: str | None = None,
    ) -> Response:
        headers: dict[str, str] = {}
        if auth_header:
            headers["Authorization"] = auth_header

        async with httpx.AsyncClient(timeout=app_settings.timeout_seconds) as client:
            try:
                upstream = await client.request(
                    method=method,
                    url=f"{base_url}{path}",
                    json=body,
                    params=params,
                    headers=headers,
                )
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Upstream unavailable: {exc}",
                ) from exc

        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            media_type=upstream.headers.get("content-type", "application/json"),
        )

    @app.get("/health", tags=["system"])
    async def health() -> dict:
        return {"status": "ok", "service": app_settings.app_name, "client": "web"}

    @app.post("/api/web/auth/register", tags=["auth"])
    async def web_register(request: Request) -> Response:
        body = await request.json()
        return await _forward("POST", app_settings.uporabniki_base_url, "/auth/register", body=body)

    @app.post("/api/web/auth/login", tags=["auth"])
    async def web_login(request: Request) -> Response:
        body = await request.json()
        return await _forward("POST", app_settings.uporabniki_base_url, "/auth/login", body=body)

    @app.get("/api/web/me", tags=["users"])
    async def web_me(authorization: str | None = Header(default=None)) -> Response:
        return await _forward("GET", app_settings.uporabniki_base_url, "/me", auth_header=authorization)

    @app.get("/api/web/parking-lots", tags=["parking"])
    async def web_list_parking_lots() -> Response:
        return await _forward("GET", app_settings.parkirisca_base_url, "/api/v1/parking-lots")

    @app.post("/api/web/parking-lots", tags=["parking"])
    async def web_create_parking_lot(request: Request) -> Response:
        body = await request.json()
        return await _forward("POST", app_settings.parkirisca_base_url, "/api/v1/parking-lots", body=body)

    @app.get("/api/web/parking-lots/{parking_lot_id}", tags=["parking"])
    async def web_get_parking_lot(parking_lot_id: str) -> Response:
        return await _forward("GET", app_settings.parkirisca_base_url, f"/api/v1/parking-lots/{parking_lot_id}")

    @app.patch("/api/web/parking-lots/{parking_lot_id}/availability", tags=["parking"])
    async def web_update_availability(parking_lot_id: str, request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "PATCH",
            app_settings.parkirisca_base_url,
            f"/api/v1/parking-lots/{parking_lot_id}/availability",
            body=body,
        )

    @app.delete("/api/web/parking-lots/{parking_lot_id}", tags=["parking"])
    async def web_delete_parking_lot(parking_lot_id: str) -> Response:
        return await _forward("DELETE", app_settings.parkirisca_base_url, f"/api/v1/parking-lots/{parking_lot_id}")

    @app.post("/api/web/reservations", tags=["reservations"])
    async def web_create_reservation(request: Request) -> Response:
        body = await request.json()
        return await _forward("POST", app_settings.rezervacije_base_url, "/api/v1/reservations", body=body)

    @app.post("/api/web/reservations/{reservation_id}/cancel", tags=["reservations"])
    async def web_cancel_reservation(reservation_id: str, request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "POST",
            app_settings.rezervacije_base_url,
            f"/api/v1/reservations/{reservation_id}/cancel",
            body=body,
        )

    @app.get("/api/web/reservations/{reservation_id}", tags=["reservations"])
    async def web_get_reservation(reservation_id: str) -> Response:
        return await _forward("GET", app_settings.rezervacije_base_url, f"/api/v1/reservations/{reservation_id}")

    @app.get("/api/web/users/{user_id}/reservations", tags=["reservations"])
    async def web_list_user_reservations(user_id: str, scope: str = Query(default="all")) -> Response:
        return await _forward(
            "GET",
            app_settings.rezervacije_base_url,
            f"/api/v1/users/{user_id}/reservations",
            params={"scope": scope},
        )

    return app


app = create_app()
