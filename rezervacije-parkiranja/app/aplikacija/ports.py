from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domena.reservation import Reservation


class ReservationRepository(Protocol):
    async def add(self, reservation: Reservation) -> None:
        ...

    async def get_by_id(self, reservation_id: str) -> Reservation | None:
        ...

    async def update(self, reservation: Reservation) -> None:
        ...

    async def list_by_user(self, user_id: str) -> list[Reservation]:
        ...

    async def has_user_overlap(
        self,
        user_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> bool:
        ...


class EventPublisher(Protocol):
    async def publish(self, event_name: str, payload: dict) -> None:
        ...
