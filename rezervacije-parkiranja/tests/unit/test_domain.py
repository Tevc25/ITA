from datetime import timedelta, timezone

import pytest

from app.domena.errors import ReservationAlreadyCancelledError, ValidationError
from app.domena.reservation import Reservation, ReservationStatus, utc_now



def test_create_reservation_normalizes_vehicle_plate_and_sets_active_status() -> None:
    start = utc_now() + timedelta(hours=1)
    end = start + timedelta(hours=2)

    reservation = Reservation.create(
        user_id="user-1",
        parking_lot_id="lot-1",
        vehicle_plate=" lj-ab-123 ",
        start_time=start,
        end_time=end,
    )

    assert reservation.status == ReservationStatus.ACTIVE
    assert reservation.vehicle_plate == "LJ-AB-123"



def test_create_reservation_rejects_past_end_time() -> None:
    start = utc_now() - timedelta(hours=3)
    end = utc_now() - timedelta(hours=1)

    with pytest.raises(ValidationError):
        Reservation.create(
            user_id="user-1",
            parking_lot_id="lot-1",
            vehicle_plate="LJ-AB-123",
            start_time=start,
            end_time=end,
        )



def test_cancel_reservation_only_once() -> None:
    start = utc_now() + timedelta(hours=1)
    end = start + timedelta(hours=1)
    reservation = Reservation.create(
        user_id="user-2",
        parking_lot_id="lot-2",
        vehicle_plate="KR-AA-999",
        start_time=start,
        end_time=end,
    )

    reservation.cancel(utc_now())
    assert reservation.status == ReservationStatus.CANCELLED
    assert reservation.cancelled_at is not None
    assert reservation.cancelled_at.tzinfo == timezone.utc

    with pytest.raises(ReservationAlreadyCancelledError):
        reservation.cancel(utc_now())
