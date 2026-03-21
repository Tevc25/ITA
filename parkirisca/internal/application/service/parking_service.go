package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"parkirisca/internal/application/dto"
	"parkirisca/internal/application/ports"
	"parkirisca/internal/domain"
)

type ParkingService struct {
	repo      ports.ParkingRepository
	logger    ports.Logger
	idFactory func() string
}

func NewParkingService(repo ports.ParkingRepository, logger ports.Logger) *ParkingService {
	return NewParkingServiceWithIDFactory(repo, logger, uuid.NewString)
}

func NewParkingServiceWithIDFactory(repo ports.ParkingRepository, logger ports.Logger, idFactory func() string) *ParkingService {
	return &ParkingService{repo: repo, logger: logger, idFactory: idFactory}
}

func (s *ParkingService) ListParkingLots(ctx context.Context) ([]domain.ParkingLot, error) {
	return s.repo.List(ctx)
}

func (s *ParkingService) GetParkingLotByID(ctx context.Context, id string) (*domain.ParkingLot, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, domain.ErrInvalidID
	}
	return s.repo.GetByID(ctx, id)
}

func (s *ParkingService) CreateParkingLot(ctx context.Context, input dto.CreateParkingLotInput) (*domain.ParkingLot, error) {
	lot, err := domain.NewParkingLot(s.idFactory(), input.Name, input.Location, input.Capacity, input.AvailableSpots)
	if err != nil {
		return nil, err
	}

	created, err := s.repo.Create(ctx, lot)
	if err != nil {
		return nil, err
	}

	s.logger.Info("parking lot created", "id", created.ID, "name", created.Name)
	return created, nil
}

func (s *ParkingService) UpdateAvailability(ctx context.Context, input dto.UpdateAvailabilityInput) (*domain.ParkingLot, error) {
	input.ID = strings.TrimSpace(input.ID)
	if input.ID == "" {
		return nil, domain.ErrInvalidID
	}
	return s.repo.UpdateAvailability(ctx, input.ID, input.AvailableSpots)
}

func (s *ParkingService) DeleteParkingLot(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return domain.ErrInvalidID
	}
	return s.repo.Delete(ctx, id)
}
