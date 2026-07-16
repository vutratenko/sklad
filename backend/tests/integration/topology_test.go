//go:build integration

package integration_test

import (
	"testing"

	topologyapp "github.com/vutratenko/sklad/internal/modules/topology/application"
	topologydomain "github.com/vutratenko/sklad/internal/modules/topology/domain"
	toppg "github.com/vutratenko/sklad/internal/modules/topology/infrastructure/postgres"
	"github.com/vutratenko/sklad/internal/testutil"
	sharedpg "github.com/vutratenko/sklad/internal/shared/postgres"
)

func TestTopologyCRUD(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	svc := topologyapp.NewTopologyService(toppg.NewTopologyRepository(&sharedpg.PoolAdapter{Pool: pool.Pool}))

	w, err := svc.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "kitchen", Name: "Kitchen"})
	if err != nil {
		t.Fatal(err)
	}

	got, err := svc.GetWarehouse(ctx, w.ID.String())
	if err != nil || got.Name != "Kitchen" {
		t.Fatalf("get warehouse: %v %+v", err, got)
	}

	name := "Kitchen updated"
	updated, err := svc.UpdateWarehouse(ctx, w.ID.String(), topologydomain.UpdateWarehouseInput{Name: &name})
	if err != nil || updated.Name != name {
		t.Fatalf("update warehouse: %v", err)
	}

	loc, err := svc.CreateLocation(ctx, w.ID.String(), topologydomain.CreateLocationInput{Code: "shelf-1", Name: "Shelf 1"})
	if err != nil {
		t.Fatal(err)
	}

	locs, err := svc.ListLocations(ctx, w.ID.String(), false)
	if err != nil || len(locs) != 1 {
		t.Fatalf("list locations: %v len=%d", err, len(locs))
	}

	locName := "Shelf A"
	locUpdated, err := svc.UpdateLocation(ctx, loc.ID.String(), topologydomain.UpdateLocationInput{Name: &locName})
	if err != nil || locUpdated.Name != locName {
		t.Fatalf("update location: %v", err)
	}

	if err := svc.DeleteLocation(ctx, loc.ID.String()); err != nil {
		t.Fatal(err)
	}

	reactivated, err := svc.CreateLocation(ctx, w.ID.String(), topologydomain.CreateLocationInput{Code: "shelf-1", Name: "Shelf restored"})
	if err != nil {
		t.Fatalf("recreate soft-deleted location: %v", err)
	}
	if reactivated.ID != loc.ID {
		t.Fatalf("expected same location id after recreate, got %s want %s", reactivated.ID, loc.ID)
	}
	if !reactivated.IsActive || reactivated.Name != "Shelf restored" {
		t.Fatalf("expected reactivated location, got %+v", reactivated)
	}

	if err := svc.DeleteLocation(ctx, loc.ID.String()); err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteWarehouse(ctx, w.ID.String()); err != nil {
		t.Fatal(err)
	}

	restoredWh, err := svc.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "kitchen", Name: "Kitchen again"})
	if err != nil {
		t.Fatalf("recreate soft-deleted warehouse: %v", err)
	}
	if restoredWh.ID != w.ID {
		t.Fatalf("expected same warehouse id after recreate, got %s want %s", restoredWh.ID, w.ID)
	}

	inactive, err := svc.ListWarehouses(ctx, true)
	if err != nil {
		t.Fatal(err)
	}
	foundActive := false
	for _, wh := range inactive {
		if wh.ID == w.ID {
			foundActive = true
			break
		}
	}
	if !foundActive {
		t.Fatal("reactivated warehouse should appear in active list")
	}
}
