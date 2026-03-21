package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"parkirisca/internal/domain"
)

type SQLiteRepository struct {
	db *sql.DB
}

func NewSQLiteRepository(db *sql.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

func (r *SQLiteRepository) List(ctx context.Context) ([]domain.ParkingLot, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, location, capacity, available_spots
		FROM parking_lots
		ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list parking lots: %w", err)
	}
	defer rows.Close()

	lots := make([]domain.ParkingLot, 0)
	for rows.Next() {
		var lot domain.ParkingLot
		if err := rows.Scan(&lot.ID, &lot.Name, &lot.Location, &lot.Capacity, &lot.AvailableSpots); err != nil {
			return nil, fmt.Errorf("scan parking lot: %w", err)
		}
		lots = append(lots, lot)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate parking lots: %w", err)
	}

	return lots, nil
}

func (r *SQLiteRepository) GetByID(ctx context.Context, id string) (*domain.ParkingLot, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, name, location, capacity, available_spots
		FROM parking_lots
		WHERE id = ?`, id)

	var lot domain.ParkingLot
	if err := row.Scan(&lot.ID, &lot.Name, &lot.Location, &lot.Capacity, &lot.AvailableSpots); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrParkingLotNotFound
		}
		return nil, fmt.Errorf("get parking lot by id: %w", err)
	}

	return &lot, nil
}

func (r *SQLiteRepository) Create(ctx context.Context, parkingLot domain.ParkingLot) (*domain.ParkingLot, error) {
	if err := parkingLot.Validate(); err != nil {
		return nil, err
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO parking_lots (id, name, location, capacity, available_spots)
		VALUES (?, ?, ?, ?, ?)`,
		parkingLot.ID, parkingLot.Name, parkingLot.Location, parkingLot.Capacity, parkingLot.AvailableSpots,
	)
	if err != nil {
		return nil, fmt.Errorf("create parking lot: %w", err)
	}

	return r.GetByID(ctx, parkingLot.ID)
}

func (r *SQLiteRepository) UpdateAvailability(ctx context.Context, id string, availableSpots int32) (*domain.ParkingLot, error) {
	lot, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if err := lot.UpdateAvailability(availableSpots); err != nil {
		return nil, err
	}

	_, err = r.db.ExecContext(ctx, `
		UPDATE parking_lots
		SET available_spots = ?
		WHERE id = ?`, lot.AvailableSpots, lot.ID)
	if err != nil {
		return nil, fmt.Errorf("update availability: %w", err)
	}

	return lot, nil
}

func (r *SQLiteRepository) Delete(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM parking_lots WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete parking lot: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete parking lot rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrParkingLotNotFound
	}

	return nil
}
