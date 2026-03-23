from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.domena.reservation import Reservation


class ReservationScopeQuery(str, Enum):
    ALL = "all"
    ACTIVE = "active"
    PAST = "past"


class CreateReservationRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=80)
    parking_lot_id: str = Field(min_length=1, max_length=80)
    vehicle_plate: str = Field(min_length=1, max_length=20)
    start_time: datetime
    end_time: datetime

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Datetime must include timezone.")
        return value


class CancelReservationRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=80)


class ReservationResponse(BaseModel):
    id: str
    user_id: str
    parking_lot_id: str
    vehicle_plate: str
    status: str
    start_time: datetime
    end_time: datetime
    created_at: datetime
    cancelled_at: datetime | None

    @classmethod
    def from_domain(cls, reservation: Reservation) -> "ReservationResponse":
        return cls(
            id=reservation.id,
            user_id=reservation.user_id,
            parking_lot_id=reservation.parking_lot_id,
            vehicle_plate=reservation.vehicle_plate,
            status=reservation.status.value,
            start_time=reservation.start_time,
            end_time=reservation.end_time,
            created_at=reservation.created_at,
            cancelled_at=reservation.cancelled_at,
        )
