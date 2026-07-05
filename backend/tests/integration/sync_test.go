//go:build integration

package integration_test

import (
	"encoding/json"
	"testing"

	catalogdomain "github.com/vutratenko/sklad/internal/modules/catalog/domain"
	catalogpg "github.com/vutratenko/sklad/internal/modules/catalog/infrastructure/postgres"
	moveapp "github.com/vutratenko/sklad/internal/modules/movements/application"
	syncapp "github.com/vutratenko/sklad/internal/modules/sync/application"
	syncpg "github.com/vutratenko/sklad/internal/modules/sync/infrastructure/postgres"
	topologydomain "github.com/vutratenko/sklad/internal/modules/topology/domain"
	toppg "github.com/vutratenko/sklad/internal/modules/topology/infrastructure/postgres"
	"github.com/vutratenko/sklad/internal/testutil"
	sharedpg "github.com/vutratenko/sklad/internal/shared/postgres"
)

func TestSyncPushPull(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	moveSvc := moveapp.NewMovementService(adapter)
	syncSvc := syncapp.NewSyncService(moveSvc, syncpg.NewEventRepository(adapter))

	sku, err := skuRepo.Create(ctx, catalogdomain.CreateSKUInput{Name: "Sync SKU", Unit: "шт"})
	if err != nil {
		t.Fatal(err)
	}
	wh, err := topoRepo.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "sync-wh", Name: "Sync WH"})
	if err != nil {
		t.Fatal(err)
	}
	loc, err := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "sync-loc", Name: "Sync Loc"})
	if err != nil {
		t.Fatal(err)
	}

	payload := map[string]any{
		"operation_type": "receipt",
		"lines": []map[string]any{{
			"sku_id": sku.ID.String(), "quantity": 5, "to_location_id": loc.ID.String(),
		}},
	}
	raw, _ := json.Marshal(payload)

	pushResp, err := syncSvc.Push(ctx, syncapp.SyncPushRequest{
		DeviceID: "sync-test-device", BatchID: "batch-1", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-1", IdempotencyKey: "op-1", Entity: "movement", Action: "create", Payload: raw,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if pushResp.AcceptedCount != 1 || pushResp.Results[0].Status != "applied" {
		t.Fatalf("expected applied push, got %+v", pushResp)
	}

	pullResp, err := syncSvc.Pull(ctx, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(pullResp.Events) == 0 {
		t.Fatal("expected sync events after movement")
	}

	dupResp, err := syncSvc.Push(ctx, syncapp.SyncPushRequest{
		DeviceID: "sync-test-device", BatchID: "batch-2", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-1-dup", IdempotencyKey: "op-1", Entity: "movement", Action: "create", Payload: raw,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if dupResp.Results[0].Status != "duplicate_replayed" {
		t.Fatalf("expected duplicate replay, got %+v", dupResp.Results[0])
	}

	badPayload, _ := json.Marshal(map[string]any{
		"operation_type": "issue", "reason_code": "used",
		"lines": []map[string]any{{"sku_id": sku.ID.String(), "quantity": 100, "from_location_id": loc.ID.String()}},
	})
	rejectResp, err := syncSvc.Push(ctx, syncapp.SyncPushRequest{
		DeviceID: "sync-test-device", BatchID: "batch-3", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-bad", IdempotencyKey: "op-bad", Entity: "movement", Action: "create", Payload: badPayload,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if rejectResp.RejectedCount != 1 || rejectResp.Results[0].Status != "rejected" {
		t.Fatalf("expected rejected insufficient stock, got %+v", rejectResp)
	}
	if rejectResp.Results[0].ErrorCode != "INSUFFICIENT_STOCK" {
		t.Fatalf("expected INSUFFICIENT_STOCK, got %s", rejectResp.Results[0].ErrorCode)
	}
}
