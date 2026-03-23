from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.aplikacija.service import ReservationService
from app.infrastruktura.broker import ActiveMQBroker, NoopBroker
from app.infrastruktura.config import Settings, get_settings
from app.infrastruktura.database import create_engine, create_session_factory, init_db
from app.infrastruktura.logging import configure_logging
from app.infrastruktura.reactive_publisher import ReactiveEventPublisher
from app.infrastruktura.repository import SqlAlchemyReservationRepository



def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    configure_logging(app_settings.log_level)
    logger = logging.getLogger(app_settings.app_name)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        from app.infrastruktura import models  # noqa: F401

        engine = create_engine(app_settings.database_url)
        session_factory = create_session_factory(engine)
        await init_db(engine)

        repository = SqlAlchemyReservationRepository(session_factory)

        if app_settings.broker_enabled:
            broker = ActiveMQBroker(
                host=app_settings.activemq_host,
                port=app_settings.activemq_port,
                username=app_settings.activemq_user,
                password=app_settings.activemq_password,
                heartbeat_ms=app_settings.activemq_heartbeat_ms,
                logger=logger,
            )
        else:
            broker = NoopBroker(logger)

        publisher = ReactiveEventPublisher(
            broker=broker,
            destination=app_settings.activemq_destination,
            logger=logger,
            broker_required=app_settings.broker_required,
        )
        await publisher.start()

        service = ReservationService(repository=repository, event_publisher=publisher, logger=logger)

        app.state.reservation_service = service
        app.state.publisher = publisher
        app.state.db_engine = engine
        logger.info("Reservation service started")

        try:
            yield
        finally:
            await publisher.stop()
            await engine.dispose()
            logger.info("Reservation service stopped")

    app = FastAPI(
        title="Rezervacije Parkiranja API",
        version="1.0.0",
        description="Mikrostoritev za upravljanje rezervacij parkirnih mest.",
        lifespan=lifespan,
    )
    app.include_router(router, prefix="/api/v1", tags=["rezervacije"])

    @app.get("/health", tags=["system"])
    async def health() -> dict:
        return {"status": "ok", "service": app_settings.app_name}

    return app


app = create_app()
