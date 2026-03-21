package unit_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"parkirisca/internal/domain"
	"parkirisca/internal/infrastructure/database"
	"parkirisca/internal/infrastructure/repository"
)

func TestSQLiteRepositoryCRUD(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "repo-test.db")
	db, err := database.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := database.Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repo := repository.NewSQLiteRepository(db)

	lot, err := domain.NewParkingLot("lot-1", "Center", "Ljubljana", 200, 150)
	if err != nil {
		t.Fatalf("new parking lot: %v", err)
	}

	created, err := repo.Create(context.Background(), lot)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.ID != "lot-1" {
		t.Fatalf("expected id lot-1, got %s", created.ID)
	}

	fetched, err := repo.GetByID(context.Background(), "lot-1")
	if err != nil {
		t.Fatalf("get by id: %v", err)
	}
	if fetched.Location != "Ljubljana" {
		t.Fatalf("expected location Ljubljana, got %s", fetched.Location)
	}

	updated, err := repo.UpdateAvailability(context.Background(), "lot-1", 120)
	if err != nil {
		t.Fatalf("update availability: %v", err)
	}
	if updated.AvailableSpots != 120 {
		t.Fatalf("expected availability 120, got %d", updated.AvailableSpots)
	}

	all, err := repo.List(context.Background())
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected one parking lot, got %d", len(all))
	}

	if err := repo.Delete(context.Background(), "lot-1"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	_, err = repo.GetByID(context.Background(), "lot-1")
	if !errors.Is(err, domain.ErrParkingLotNotFound) {
		t.Fatalf("expected %v, got %v", domain.ErrParkingLotNotFound, err)
	}
}
