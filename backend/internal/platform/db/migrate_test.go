package db_test

import (
	"context"
	"os"
	"testing"

	"github.com/vutratenko/sklad/internal/platform/db"
	"github.com/vutratenko/sklad/internal/testutil"
)

func TestRunMigrations_RequiresDirectory(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	dir := testutil.MigrationsDir()
	if err := pool.RunMigrations(ctx, dir); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}
	if err := pool.RunMigrations(ctx, dir); err != nil {
		t.Fatalf("RunMigrations second run: %v", err)
	}
}
