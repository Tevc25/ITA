from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domena.reservation import Reservation, ReservationStatus
from app.infrastruktura.models import ReservationModel



def _ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _to_domain(model: ReservationModel) -> Reservation:
    return Reservation(
        id=model.id,
        user_id=model.user_id,
        parking_lot_id=model.parking_lot_id,
        vehicle_plate=model.vehicle_plate,
        start_time=_ensure_utc(model.start_time),
        end_time=_ensure_utc(model.end_time),
        status=ReservationStatus(model.status),
        created_at=_ensure_utc(model.created_at),
        cancelled_at=_ensure_utc(model.cancelled_at),
    )



def _to_model(reservation: Reservation) -> ReservationModel:
    return ReservationModel(
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


class SqlAlchemyReservationRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def add(self, reservation: Reservation) -> None:
        async with self._session_factory() as session:
            session.add(_to_model(reservation))
            await session.commit()

    async def get_by_id(self, reservation_id: str) -> Reservation | None:
        async with self._session_factory() as session:
            model = await session.get(ReservationModel, reservation_id)
            if model is None:
                return None
            return _to_domain(model)

    async def update(self, reservation: Reservation) -> None:
        async with self._session_factory() as session:
            model = await session.get(ReservationModel, reservation.id)
            if model is None:
                return

            model.user_id = reservation.user_id
            model.parking_lot_id = reservation.parking_lot_id
            model.vehicle_plate = reservation.vehicle_plate
            model.status = reservation.status.value
            model.start_time = reservation.start_time
            model.end_time = reservation.end_time
            model.created_at = reservation.created_at
            model.cancelled_at = reservation.cancelled_at

            await session.commit()

    async def list_by_user(self, user_id: str) -> list[Reservation]:
        async with self._session_factory() as session:
            statement = (
                select(ReservationModel)
                .where(ReservationModel.user_id == user_id)
                .order_by(ReservationModel.start_time.desc())
            )
            result = await session.scalars(statement)
            return [_to_domain(model) for model in result.all()]

    async def has_user_overlap(
        self,
        user_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> bool:
        async with self._session_factory() as session:
            statement = select(func.count()).select_from(ReservationModel).where(
                ReservationModel.user_id == user_id,
                ReservationModel.status == ReservationStatus.ACTIVE.value,
                ReservationModel.end_time > start_time,
                ReservationModel.start_time < end_time,
            )
            total = await session.scalar(statement)
            return bool(total and total > 0)
