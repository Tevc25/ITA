package ports

import (
	"context"

	"parkirisca/internal/domain"
)

type ParkingRepository interface {
	List(ctx context.Context) ([]domain.ParkingLot, error)
	GetByID(ctx context.Context, id string) (*domain.ParkingLot, error)
	Create(ctx context.Context, parkingLot domain.ParkingLot) (*domain.ParkingLot, error)
	UpdateAvailability(ctx context.Context, id string, availableSpots int32) (*domain.ParkingLot, error)
	Delete(ctx context.Context, id string) error
}
