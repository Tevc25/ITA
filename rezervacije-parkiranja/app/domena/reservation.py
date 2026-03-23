from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from app.domena.errors import ReservationAlreadyCancelledError, ValidationError


class ReservationStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"



def utc_now() -> datetime:
    return datetime.now(timezone.utc)



def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValidationError("Datetime values must include timezone info.")
    return value.astimezone(timezone.utc)


@dataclass(slots=True)
class Reservation:
    id: str
    user_id: str
    parking_lot_id: str
    vehicle_plate: str
    start_time: datetime
    end_time: datetime
    status: ReservationStatus = ReservationStatus.ACTIVE
    created_at: datetime = field(default_factory=utc_now)
    cancelled_at: datetime | None = None

    @classmethod
    def create(
        cls,
        user_id: str,
        parking_lot_id: str,
        vehicle_plate: str,
        start_time: datetime,
        end_time: datetime,
    ) -> "Reservation":
        start_utc = normalize_utc(start_time)
        end_utc = normalize_utc(end_time)
        now = utc_now()

        if not user_id.strip():
            raise ValidationError("user_id is required.")
        if not parking_lot_id.strip():
            raise ValidationError("parking_lot_id is required.")
        if not vehicle_plate.strip():
            raise ValidationError("vehicle_plate is required.")
        if start_utc >= end_utc:
            raise ValidationError("start_time must be before end_time.")
        if end_utc <= now:
            raise ValidationError("end_time must be in the future.")

        return cls(
            id=str(uuid4()),
            user_id=user_id.strip(),
            parking_lot_id=parking_lot_id.strip(),
            vehicle_plate=vehicle_plate.strip().upper(),
            start_time=start_utc,
            end_time=end_utc,
        )

    def cancel(self, cancelled_at: datetime | None = None) -> None:
        if self.status == ReservationStatus.CANCELLED:
            raise ReservationAlreadyCancelledError("Reservation already cancelled.")

        when = normalize_utc(cancelled_at or utc_now())
        self.status = ReservationStatus.CANCELLED
        self.cancelled_at = when

    def is_active(self, now: datetime | None = None) -> bool:
        check_time = normalize_utc(now or utc_now())
        return self.status == ReservationStatus.ACTIVE and self.end_time > check_time

    def is_past(self, now: datetime | None = None) -> bool:
        return not self.is_active(now)
