import logging
from datetime import timedelta

import pytest

from app.aplikacija.errors import ConflictError, ForbiddenError, NotFoundError
from app.aplikacija.service import CreateReservationCommand, ReservationScope, ReservationService
from app.domena.reservation import Reservation, ReservationStatus, utc_now


class FakeRepository:
    def __init__(self) -> None:
        self._data: dict[str, Reservation] = {}

    async def add(self, reservation: Reservation) -> None:
        self._data[reservation.id] = reservation

    async def get_by_id(self, reservation_id: str) -> Reservation | None:
        return self._data.get(reservation_id)

    async def update(self, reservation: Reservation) -> None:
        self._data[reservation.id] = reservation

    async def list_by_user(self, user_id: str) -> list[Reservation]:
        return [reservation for reservation in self._data.values() if reservation.user_id == user_id]

    async def has_user_overlap(self, user_id, start_time, end_time) -> bool:
        for reservation in self._data.values():
            if reservation.user_id != user_id:
                continue
            if reservation.status != ReservationStatus.ACTIVE:
                continue
            if reservation.end_time > start_time and reservation.start_time < end_time:
                return True
        return False


class FakePublisher:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    async def publish(self, event_name: str, payload: dict) -> None:
        self.events.append((event_name, payload))


@pytest.fixture
def service() -> ReservationService:
    repository = FakeRepository()
    publisher = FakePublisher()
    logger = logging.getLogger("test-service")
    return ReservationService(repository=repository, event_publisher=publisher, logger=logger)


@pytest.mark.asyncio
async def test_create_reservation_publishes_event(service: ReservationService) -> None:
    start = utc_now() + timedelta(hours=1)
    end = start + timedelta(hours=2)

    reservation = await service.create_reservation(
        CreateReservationCommand(
            user_id="u-1",
            parking_lot_id="p-1",
            vehicle_plate="MB-AA-123",
            start_time=start,
            end_time=end,
        )
    )

    assert reservation.id
    publisher = service.event_publisher
    assert isinstance(publisher, FakePublisher)
    assert publisher.events[0][0] == "reservation.created"


@pytest.mark.asyncio
async def test_create_reservation_rejects_overlap(service: ReservationService) -> None:
    start = utc_now() + timedelta(hours=1)
    end = start + timedelta(hours=2)

    await service.create_reservation(
        CreateReservationCommand(
            user_id="u-2",
            parking_lot_id="p-1",
            vehicle_plate="NM-BB-123",
            start_time=start,
            end_time=end,
        )
    )

    with pytest.raises(ConflictError):
        await service.create_reservation(
            CreateReservationCommand(
                user_id="u-2",
                parking_lot_id="p-2",
                vehicle_plate="NM-CC-123",
                start_time=start + timedelta(minutes=10),
                end_time=end + timedelta(minutes=10),
            )
        )


@pytest.mark.asyncio
async def test_cancel_reservation_requires_owner(service: ReservationService) -> None:
    start = utc_now() + timedelta(hours=1)
    end = start + timedelta(hours=1)

    reservation = await service.create_reservation(
        CreateReservationCommand(
            user_id="u-3",
            parking_lot_id="p-3",
            vehicle_plate="KR-XY-111",
            start_time=start,
            end_time=end,
        )
    )

    with pytest.raises(ForbiddenError):
        await service.cancel_reservation(reservation.id, user_id="u-4")


@pytest.mark.asyncio
async def test_list_scope_active_and_past(service: ReservationService) -> None:
    active_start = utc_now() + timedelta(hours=1)
    active_end = active_start + timedelta(hours=2)

    await service.create_reservation(
        CreateReservationCommand(
            user_id="u-5",
            parking_lot_id="p-9",
            vehicle_plate="CE-AA-555",
            start_time=active_start,
            end_time=active_end,
        )
    )

    past_reservation = Reservation(
        id="past-res",
        user_id="u-5",
        parking_lot_id="p-8",
        vehicle_plate="CE-BB-555",
        start_time=utc_now() - timedelta(hours=4),
        end_time=utc_now() - timedelta(hours=2),
        status=ReservationStatus.ACTIVE,
        created_at=utc_now() - timedelta(hours=5),
        cancelled_at=None,
    )
    await service.repository.add(past_reservation)

    active = await service.list_user_reservations(user_id="u-5", scope=ReservationScope.ACTIVE)
    past = await service.list_user_reservations(user_id="u-5", scope=ReservationScope.PAST)

    assert len(active) == 1
    assert len(past) == 1


@pytest.mark.asyncio
async def test_cancel_missing_reservation_raises_not_found(service: ReservationService) -> None:
    with pytest.raises(NotFoundError):
        await service.cancel_reservation("missing-id", "u-1")
