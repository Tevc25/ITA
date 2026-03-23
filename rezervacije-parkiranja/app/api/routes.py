from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.schemas import (
    CancelReservationRequest,
    CreateReservationRequest,
    ReservationResponse,
    ReservationScopeQuery,
)
from app.aplikacija.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.aplikacija.service import CreateReservationCommand, ReservationScope, ReservationService

router = APIRouter()



def get_service(request: Request) -> ReservationService:
    return request.app.state.reservation_service



def _raise_http_from_error(error: Exception) -> None:
    if isinstance(error, BadRequestError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    if isinstance(error, ConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, ForbiddenError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, NotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    raise error


@router.post(
    "/reservations",
    status_code=status.HTTP_201_CREATED,
    response_model=ReservationResponse,
    summary="Ustvari novo rezervacijo",
)
async def create_reservation(request: Request, payload: CreateReservationRequest) -> ReservationResponse:
    service = get_service(request)
    command = CreateReservationCommand(
        user_id=payload.user_id,
        parking_lot_id=payload.parking_lot_id,
        vehicle_plate=payload.vehicle_plate,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )

    try:
        reservation = await service.create_reservation(command)
        return ReservationResponse.from_domain(reservation)
    except (BadRequestError, ConflictError, ForbiddenError, NotFoundError) as error:
        _raise_http_from_error(error)


@router.post(
    "/reservations/{reservation_id}/cancel",
    response_model=ReservationResponse,
    summary="Prekliči rezervacijo",
)
async def cancel_reservation(
    reservation_id: str,
    request: Request,
    payload: CancelReservationRequest,
) -> ReservationResponse:
    service = get_service(request)

    try:
        reservation = await service.cancel_reservation(reservation_id=reservation_id, user_id=payload.user_id)
        return ReservationResponse.from_domain(reservation)
    except (BadRequestError, ConflictError, ForbiddenError, NotFoundError) as error:
        _raise_http_from_error(error)


@router.get("/reservations/{reservation_id}", response_model=ReservationResponse, summary="Pridobi rezervacijo")
async def get_reservation(reservation_id: str, request: Request) -> ReservationResponse:
    service = get_service(request)

    try:
        reservation = await service.get_reservation(reservation_id)
        return ReservationResponse.from_domain(reservation)
    except (BadRequestError, ConflictError, ForbiddenError, NotFoundError) as error:
        _raise_http_from_error(error)


@router.get(
    "/users/{user_id}/reservations",
    response_model=list[ReservationResponse],
    summary="Seznam rezervacij uporabnika",
)
async def list_reservations_by_user(
    user_id: str,
    request: Request,
    scope: ReservationScopeQuery = Query(default=ReservationScopeQuery.ALL),
) -> list[ReservationResponse]:
    service = get_service(request)

    try:
        mapped_scope = ReservationScope(scope.value)
        reservations = await service.list_user_reservations(user_id=user_id, scope=mapped_scope)
        return [ReservationResponse.from_domain(item) for item in reservations]
    except (BadRequestError, ConflictError, ForbiddenError, NotFoundError) as error:
        _raise_http_from_error(error)
