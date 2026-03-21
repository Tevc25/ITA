package database

import (
	"context"
	"database/sql"
	"fmt"
)

const createParkingLotsTable = `
CREATE TABLE IF NOT EXISTS parking_lots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity >= 0),
    available_spots INTEGER NOT NULL CHECK (available_spots >= 0 AND available_spots <= capacity),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

func Migrate(ctx context.Context, db *sql.DB) error {
	if _, err := db.ExecContext(ctx, createParkingLotsTable); err != nil {
		return fmt.Errorf("create parking_lots table: %w", err)
	}
	return nil
}
