package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

func Open(driver, dbPath string) (*sql.DB, error) {
	driver = strings.TrimSpace(driver)
	dbPath = strings.TrimSpace(dbPath)

	if driver != "sqlite" {
		return nil, fmt.Errorf("unsupported db driver: %s", driver)
	}
	if dbPath == "" {
		return nil, fmt.Errorf("db path is required")
	}

	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create db dir: %w", err)
		}
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return db, nil
}
