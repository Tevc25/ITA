from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import time
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException, Query, Request, Response, status

from app.circuit_breaker import CircuitBreaker
from app.config import Settings, get_settings



def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    service_catalog = {
        "uporabniki": {"base_url": app_settings.uporabniki_base_url, "health_path": "/"},
        "parkirisca": {"base_url": app_settings.parkirisca_base_url, "health_path": "/health"},
        "rezervacije-parkiranja": {"base_url": app_settings.rezervacije_base_url, "health_path": "/health"},
        "gateway-mobile": {"base_url": app_settings.gateway_mobile_base_url, "health_path": "/health"},
    }
    circuit_breakers = {
        service_name: CircuitBreaker(
            failure_threshold=app_settings.circuit_breaker_failure_threshold,
            recovery_timeout_seconds=app_settings.circuit_breaker_recovery_timeout_seconds,
        )
        for service_name in service_catalog
    }

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
        service_name: str,
    ) -> Response:
        breaker = circuit_breakers[service_name]
        if not breaker.allow_request():
            snapshot = breaker.snapshot()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    f"Service '{service_name}' temporarily unavailable (circuit open, "
                    f"retry after {snapshot['retry_after_seconds']}s)."
                ),
            )

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
                breaker.record_failure()
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Upstream unavailable: {exc}",
                ) from exc

        if upstream.status_code >= 500:
            breaker.record_failure()
        else:
            breaker.record_success()

        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            media_type=upstream.headers.get("content-type", "application/json"),
        )

    async def _probe_service(service_name: str, base_url: str, health_path: str) -> dict[str, Any]:
        breaker = circuit_breakers[service_name]
        if not breaker.allow_request():
            snapshot = breaker.snapshot()
            return {
                "service": service_name,
                "base_url": base_url,
                "health_path": health_path,
                "up": False,
                "status": "circuit_open",
                "status_code": None,
                "latency_ms": None,
                "detail": f"Circuit open. Retry after {snapshot['retry_after_seconds']}s.",
                "circuit_breaker": snapshot,
            }

        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=app_settings.timeout_seconds) as client:
                response = await client.get(f"{base_url}{health_path}")
        except httpx.RequestError as exc:
            breaker.record_failure()
            return {
                "service": service_name,
                "base_url": base_url,
                "health_path": health_path,
                "up": False,
                "status": "down",
                "status_code": None,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                "detail": f"Unreachable: {exc}",
                "circuit_breaker": breaker.snapshot(),
            }

        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        detail: str | None = None
        payload_status: str | None = None

        if response.status_code >= 500:
            breaker.record_failure()
        else:
            breaker.record_success()

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                payload = json.loads(response.content.decode("utf-8"))
                if isinstance(payload, dict):
                    raw_status = payload.get("status")
                    if isinstance(raw_status, str):
                        payload_status = raw_status
            except (UnicodeDecodeError, json.JSONDecodeError):
                detail = "Invalid JSON payload on health endpoint."

        up = response.status_code < 400
        if payload_status and payload_status.lower() != "ok":
            up = False
            detail = detail or f"Service reported status={payload_status!r}"

        if not up and detail is None:
            detail = f"Health endpoint returned HTTP {response.status_code}"

        return {
            "service": service_name,
            "base_url": base_url,
            "health_path": health_path,
            "up": up,
            "status": "ok" if up else "degraded",
            "status_code": response.status_code,
            "latency_ms": latency_ms,
            "detail": detail,
            "circuit_breaker": breaker.snapshot(),
        }

    @app.get("/health", tags=["system"])
    async def health() -> dict:
        return {"status": "ok", "service": app_settings.app_name, "client": "web"}

    @app.get("/api/web/system/status", tags=["system"])
    async def web_system_status() -> dict[str, Any]:
        service_checks = await asyncio.gather(
            *(
                _probe_service(name, metadata["base_url"], metadata["health_path"])
                for name, metadata in service_catalog.items()
            )
        )

        services = [
            {
                "service": app_settings.app_name,
                "base_url": "self",
                "health_path": "/health",
                "up": True,
                "status": "ok",
                "status_code": 200,
                "latency_ms": 0,
                "detail": None,
                "circuit_breaker": None,
            },
            *service_checks,
        ]
        any_down = any(not item["up"] for item in services)
        overall_status = "degraded" if any_down else "ok"

        return {
            "status": overall_status,
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "services": services,
        }

    @app.post("/api/web/auth/register", tags=["auth"])
    async def web_register(request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "POST",
            app_settings.uporabniki_base_url,
            "/auth/register",
            body=body,
            service_name="uporabniki",
        )

    @app.post("/api/web/auth/login", tags=["auth"])
    async def web_login(request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "POST",
            app_settings.uporabniki_base_url,
            "/auth/login",
            body=body,
            service_name="uporabniki",
        )

    @app.get("/api/web/me", tags=["users"])
    async def web_me(authorization: str | None = Header(default=None)) -> Response:
        return await _forward(
            "GET",
            app_settings.uporabniki_base_url,
            "/me",
            auth_header=authorization,
            service_name="uporabniki",
        )

    @app.get("/api/web/parking-lots", tags=["parking"])
    async def web_list_parking_lots() -> Response:
        return await _forward(
            "GET",
            app_settings.parkirisca_base_url,
            "/api/v1/parking-lots",
            service_name="parkirisca",
        )

    @app.post("/api/web/parking-lots", tags=["parking"])
    async def web_create_parking_lot(request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "POST",
            app_settings.parkirisca_base_url,
            "/api/v1/parking-lots",
            body=body,
            service_name="parkirisca",
        )

    @app.get("/api/web/parking-lots/{parking_lot_id}", tags=["parking"])
    async def web_get_parking_lot(parking_lot_id: str) -> Response:
        return await _forward(
            "GET",
            app_settings.parkirisca_base_url,
            f"/api/v1/parking-lots/{parking_lot_id}",
            service_name="parkirisca",
        )

    @app.patch("/api/web/parking-lots/{parking_lot_id}/availability", tags=["parking"])
    async def web_update_availability(parking_lot_id: str, request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "PATCH",
            app_settings.parkirisca_base_url,
            f"/api/v1/parking-lots/{parking_lot_id}/availability",
            body=body,
            service_name="parkirisca",
        )

    @app.delete("/api/web/parking-lots/{parking_lot_id}", tags=["parking"])
    async def web_delete_parking_lot(parking_lot_id: str) -> Response:
        return await _forward(
            "DELETE",
            app_settings.parkirisca_base_url,
            f"/api/v1/parking-lots/{parking_lot_id}",
            service_name="parkirisca",
        )

    @app.post("/api/web/reservations", tags=["reservations"])
    async def web_create_reservation(request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "POST",
            app_settings.rezervacije_base_url,
            "/api/v1/reservations",
            body=body,
            service_name="rezervacije-parkiranja",
        )

    @app.post("/api/web/reservations/{reservation_id}/cancel", tags=["reservations"])
    async def web_cancel_reservation(reservation_id: str, request: Request) -> Response:
        body = await request.json()
        return await _forward(
            "POST",
            app_settings.rezervacije_base_url,
            f"/api/v1/reservations/{reservation_id}/cancel",
            body=body,
            service_name="rezervacije-parkiranja",
        )

    @app.get("/api/web/reservations/{reservation_id}", tags=["reservations"])
    async def web_get_reservation(reservation_id: str) -> Response:
        return await _forward(
            "GET",
            app_settings.rezervacije_base_url,
            f"/api/v1/reservations/{reservation_id}",
            service_name="rezervacije-parkiranja",
        )

    @app.get("/api/web/users/{user_id}/reservations", tags=["reservations"])
    async def web_list_user_reservations(user_id: str, scope: str = Query(default="all")) -> Response:
        return await _forward(
            "GET",
            app_settings.rezervacije_base_url,
            f"/api/v1/users/{user_id}/reservations",
            params={"scope": scope},
            service_name="rezervacije-parkiranja",
        )

    return app


app = create_app()
