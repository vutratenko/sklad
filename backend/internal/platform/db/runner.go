package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

func DefaultMigrationsDir() string {
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}
	return filepath.Join("migrations")
}

func Run(ctx context.Context, databaseURL string) error {
	pool, err := Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	dir := DefaultMigrationsDir()
	if err := pool.RunMigrations(ctx, dir); err != nil {
		return fmt.Errorf("migrations: %w", err)
	}
	return nil
}
