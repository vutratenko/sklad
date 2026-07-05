//go:build integration

package integration_test

import (
	"testing"

	catalogdomain "github.com/vutratenko/sklad/internal/modules/catalog/domain"
	catalogpg "github.com/vutratenko/sklad/internal/modules/catalog/infrastructure/postgres"
	moveapp "github.com/vutratenko/sklad/internal/modules/movements/application"
	movedomain "github.com/vutratenko/sklad/internal/modules/movements/domain"
	topologydomain "github.com/vutratenko/sklad/internal/modules/topology/domain"
	toppg "github.com/vutratenko/sklad/internal/modules/topology/infrastructure/postgres"
	"github.com/vutratenko/sklad/internal/testutil"
	sharedpg "github.com/vutratenko/sklad/internal/shared/postgres"
)

func TestMovementReceiptAndIssue(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)

	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	moveSvc := moveapp.NewMovementService(adapter)

	sku, err := skuRepo.Create(ctx, catalogdomain.CreateSKUInput{Name: "Test Jam", Unit: "шт"})
	if err != nil {
		t.Fatal(err)
	}
	wh, err := topoRepo.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "kitchen", Name: "Kitchen"})
	if err != nil {
		t.Fatal(err)
	}
	loc, err := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "shelf-1", Name: "Shelf 1"})
	if err != nil {
		t.Fatal(err)
	}

	receiptPayload := map[string]any{
		"operation_type": "receipt",
		"lines":          []map[string]any{{"sku_id": sku.ID.String(), "quantity": 10, "to_location_id": loc.ID.String()}},
	}
	hash := moveapp.HashPayload(receiptPayload)
	_, err = moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpReceipt,
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 10, ToLocationID: &loc.ID}},
		DeviceID:      "test-device",
		OperationKey:  "receipt-1",
		PayloadHash:   hash,
		CreatedBy:     "test",
	})
	if err != nil {
		t.Fatalf("receipt: %v", err)
	}

	issuePayload := map[string]any{
		"operation_type": "issue",
		"reason_code":    "used",
		"lines":          []map[string]any{{"sku_id": sku.ID.String(), "quantity": 3, "from_location_id": loc.ID.String()}},
	}
	issueHash := moveapp.HashPayload(issuePayload)
	_, err = moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpIssue,
		ReasonCode:    "used",
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 3, FromLocationID: &loc.ID}},
		DeviceID:      "test-device",
		OperationKey:  "issue-1",
		PayloadHash:   issueHash,
		CreatedBy:     "test",
	})
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	// Idempotency: replay same receipt
	res, err := moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpReceipt,
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 10, ToLocationID: &loc.ID}},
		DeviceID:      "test-device",
		OperationKey:  "receipt-1",
		PayloadHash:   hash,
		CreatedBy:     "test",
	})
	if err != nil {
		t.Fatalf("idempotent replay: %v", err)
	}
	if res.Applied {
		t.Fatal("expected duplicate replay, not new apply")
	}

	var qty int
	err = pool.QueryRow(ctx, `
		SELECT quantity FROM stock_balances WHERE sku_id = $1 AND location_id = $2
	`, sku.ID, loc.ID).Scan(&qty)
	if err != nil {
		t.Fatal(err)
	}
	if qty != 7 {
		t.Fatalf("expected qty 7, got %d", qty)
	}
}

func TestInsufficientStock(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	moveSvc := moveapp.NewMovementService(adapter)

	sku, _ := skuRepo.Create(ctx, catalogdomain.CreateSKUInput{Name: "Empty SKU", Unit: "шт"})
	wh, _ := topoRepo.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "garage", Name: "Garage"})
	loc, _ := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "box-1", Name: "Box 1"})

	_, err := moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpIssue,
		ReasonCode:    "lost",
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 1, FromLocationID: &loc.ID}},
		DeviceID:      "test-device",
		OperationKey:  "issue-empty",
		PayloadHash:   "hash",
		CreatedBy:     "test",
	})
	if err == nil {
		t.Fatal("expected insufficient stock error")
	}
}
