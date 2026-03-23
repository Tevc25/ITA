from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from app.aplikacija.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.aplikacija.ports import EventPublisher, ReservationRepository
from app.domena.errors import ReservationAlreadyCancelledError, ValidationError
from app.domena.reservation import Reservation, utc_now


class ReservationScope(str, Enum):
    ALL = "all"
    ACTIVE = "active"
    PAST = "past"


@dataclass(slots=True)
class CreateReservationCommand:
    user_id: str
    parking_lot_id: str
    vehicle_plate: str
    start_time: datetime
    end_time: datetime


@dataclass(slots=True)
class ReservationService:
    repository: ReservationRepository
    event_publisher: EventPublisher
    logger: logging.Logger

    async def create_reservation(self, command: CreateReservationCommand) -> Reservation:
        if await self.repository.has_user_overlap(
            command.user_id,
            command.start_time,
            command.end_time,
        ):
            raise ConflictError("User already has an overlapping active reservation.")

        try:
            reservation = Reservation.create(
                user_id=command.user_id,
                parking_lot_id=command.parking_lot_id,
                vehicle_plate=command.vehicle_plate,
                start_time=command.start_time,
                end_time=command.end_time,
            )
        except ValidationError as exc:
            raise BadRequestError(str(exc)) from exc

        await self.repository.add(reservation)
        await self.event_publisher.publish(
            "reservation.created",
            {
                "reservation_id": reservation.id,
                "user_id": reservation.user_id,
                "parking_lot_id": reservation.parking_lot_id,
                "vehicle_plate": reservation.vehicle_plate,
                "start_time": reservation.start_time.isoformat(),
                "end_time": reservation.end_time.isoformat(),
            },
        )
        self.logger.info("Reservation created", extra={"reservation_id": reservation.id})
        return reservation

    async def cancel_reservation(self, reservation_id: str, user_id: str) -> Reservation:
        reservation = await self.repository.get_by_id(reservation_id)
        if reservation is None:
            raise NotFoundError("Reservation not found.")
        if reservation.user_id != user_id:
            raise ForbiddenError("Reservation belongs to another user.")

        try:
            reservation.cancel(utc_now())
        except ReservationAlreadyCancelledError as exc:
            raise ConflictError(str(exc)) from exc

        await self.repository.update(reservation)
        await self.event_publisher.publish(
            "reservation.cancelled",
            {
                "reservation_id": reservation.id,
                "user_id": reservation.user_id,
                "parking_lot_id": reservation.parking_lot_id,
                "cancelled_at": reservation.cancelled_at.isoformat() if reservation.cancelled_at else None,
            },
        )
        self.logger.info("Reservation cancelled", extra={"reservation_id": reservation.id})
        return reservation

    async def get_reservation(self, reservation_id: str) -> Reservation:
        reservation = await self.repository.get_by_id(reservation_id)
        if reservation is None:
            raise NotFoundError("Reservation not found.")
        return reservation

    async def list_user_reservations(
        self,
        user_id: str,
        scope: ReservationScope = ReservationScope.ALL,
    ) -> list[Reservation]:
        if not user_id.strip():
            raise BadRequestError("user_id is required.")

        reservations = await self.repository.list_by_user(user_id.strip())
        now = utc_now()

        if scope == ReservationScope.ACTIVE:
            return [reservation for reservation in reservations if reservation.is_active(now)]
        if scope == ReservationScope.PAST:
            return [reservation for reservation in reservations if reservation.is_past(now)]
        return reservations
