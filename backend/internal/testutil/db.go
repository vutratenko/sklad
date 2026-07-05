package testutil

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/vutratenko/sklad/internal/platform/db"
)

// MigrationsDir returns the absolute path to backend/migrations.
func MigrationsDir() string {
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "migrations")
}

func resetData(t *testing.T, ctx context.Context, pool *db.Pool) {
	t.Helper()
	_, err := pool.Exec(ctx, `
		TRUNCATE TABLE
			sync_events,
			stock_balances,
			stock_movements,
			operations,
			lots,
			locations,
			warehouses,
			sku_barcodes,
			skus
		RESTART IDENTITY CASCADE
	`)
	if err != nil {
		t.Fatalf("reset test data: %v", err)
	}
}

// ConnectAndMigrate opens PostgreSQL and applies migrations. Skips when DATABASE_URL is unset.
func ConnectAndMigrate(t *testing.T) (context.Context, *db.Pool) {
	t.Helper()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Close() })
	if err := pool.RunMigrations(ctx, MigrationsDir()); err != nil {
		t.Fatal(err)
	}
	resetData(t, ctx, pool)
	return ctx, pool
}
