from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from app.aplikacija.ports import EventPublisher
from app.infrastruktura.broker import MessageBroker, NoopBroker


@dataclass(slots=True)
class IntegrationEvent:
    event_name: str
    payload: dict



def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ReactiveEventPublisher(EventPublisher):
    def __init__(
        self,
        broker: MessageBroker,
        destination: str,
        logger: logging.Logger,
        broker_required: bool,
    ) -> None:
        self._broker = broker
        self._destination = destination
        self._logger = logger
        self._broker_required = broker_required

        self._queue: asyncio.Queue[IntegrationEvent | None] = asyncio.Queue()
        self._worker_task: asyncio.Task[None] | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return

        try:
            await self._broker.connect()
        except Exception:
            if self._broker_required:
                raise
            self._logger.exception("Could not connect to broker. Service continues in degraded mode.")
            self._broker = NoopBroker(self._logger)
            await self._broker.connect()

        self._running = True
        self._worker_task = asyncio.create_task(self._run(), name="event-publisher")

    async def stop(self) -> None:
        if not self._running:
            return

        await self._queue.put(None)
        if self._worker_task is not None:
            await self._worker_task
        await self._broker.disconnect()
        self._running = False

    async def publish(self, event_name: str, payload: dict) -> None:
        await self._queue.put(IntegrationEvent(event_name=event_name, payload=payload))

    async def _run(self) -> None:
        while True:
            event = await self._queue.get()
            if event is None:
                break

            body = json.dumps(
                {
                    "event": event.event_name,
                    "payload": event.payload,
                    "sent_at": utc_now_iso(),
                }
            )

            try:
                await self._broker.publish(self._destination, body)
            except Exception:
                self._logger.exception(
                    "Failed to publish event",
                    extra={"event": event.event_name, "destination": self._destination},
                )
