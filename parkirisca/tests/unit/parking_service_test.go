package unit_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"parkirisca/internal/application/dto"
	appservice "parkirisca/internal/application/service"
	"parkirisca/internal/domain"
)

type memoryRepo struct {
	items map[string]domain.ParkingLot
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{items: map[string]domain.ParkingLot{}}
}

func (r *memoryRepo) List(_ context.Context) ([]domain.ParkingLot, error) {
	out := make([]domain.ParkingLot, 0, len(r.items))
	for _, item := range r.items {
		out = append(out, item)
	}
	return out, nil
}

func (r *memoryRepo) GetByID(_ context.Context, id string) (*domain.ParkingLot, error) {
	item, ok := r.items[id]
	if !ok {
		return nil, domain.ErrParkingLotNotFound
	}
	copy := item
	return &copy, nil
}

func (r *memoryRepo) Create(_ context.Context, lot domain.ParkingLot) (*domain.ParkingLot, error) {
	r.items[lot.ID] = lot
	copy := lot
	return &copy, nil
}

func (r *memoryRepo) UpdateAvailability(_ context.Context, id string, availableSpots int32) (*domain.ParkingLot, error) {
	item, ok := r.items[id]
	if !ok {
		return nil, domain.ErrParkingLotNotFound
	}
	if err := item.UpdateAvailability(availableSpots); err != nil {
		return nil, err
	}
	r.items[id] = item
	copy := item
	return &copy, nil
}

func (r *memoryRepo) Delete(_ context.Context, id string) error {
	if _, ok := r.items[id]; !ok {
		return domain.ErrParkingLotNotFound
	}
	delete(r.items, id)
	return nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(io.Discard, nil))
}

func TestParkingServiceCreateAndUpdate(t *testing.T) {
	repo := newMemoryRepo()
	svc := appservice.NewParkingServiceWithIDFactory(repo, testLogger(), func() string { return "lot-1" })

	created, err := svc.CreateParkingLot(context.Background(), dto.CreateParkingLotInput{
		Name:           "Center",
		Location:       "Ljubljana",
		Capacity:       100,
		AvailableSpots: 60,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if created.ID != "lot-1" {
		t.Fatalf("expected id lot-1, got %s", created.ID)
	}

	updated, err := svc.UpdateAvailability(context.Background(), dto.UpdateAvailabilityInput{
		ID:             "lot-1",
		AvailableSpots: 40,
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if updated.AvailableSpots != 40 {
		t.Fatalf("expected available spots 40, got %d", updated.AvailableSpots)
	}
}

func TestParkingServiceValidation(t *testing.T) {
	repo := newMemoryRepo()
	svc := appservice.NewParkingServiceWithIDFactory(repo, testLogger(), func() string { return "lot-2" })

	_, err := svc.CreateParkingLot(context.Background(), dto.CreateParkingLotInput{
		Name:           "Center",
		Location:       "Ljubljana",
		Capacity:       10,
		AvailableSpots: 20,
	})
	if !errors.Is(err, domain.ErrAvailabilityExceedsCap) {
		t.Fatalf("expected %v, got %v", domain.ErrAvailabilityExceedsCap, err)
	}

	_, err = svc.GetParkingLotByID(context.Background(), "")
	if !errors.Is(err, domain.ErrInvalidID) {
		t.Fatalf("expected %v, got %v", domain.ErrInvalidID, err)
	}
}
