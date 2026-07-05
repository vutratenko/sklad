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
	if err := svc.DeleteWarehouse(ctx, w.ID.String()); err != nil {
		t.Fatal(err)
	}

	inactive, err := svc.ListWarehouses(ctx, true)
	if err != nil {
		t.Fatal(err)
	}
	for _, wh := range inactive {
		if wh.ID == w.ID {
			t.Fatal("deleted warehouse should not appear in active list")
		}
	}
}
