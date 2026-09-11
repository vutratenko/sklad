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
	"github.com/vutratenko/sklad/internal/shared/apperr"
	"github.com/vutratenko/sklad/internal/testutil"
	sharedpg "github.com/vutratenko/sklad/internal/shared/postgres"
)

func TestTransferMovement(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	moveSvc := moveapp.NewMovementService(adapter)

	sku, err := skuRepo.Create(ctx, catalogdomain.CreateSKUInput{Name: "Transfer SKU", Unit: "шт"})
	if err != nil {
		t.Fatal(err)
	}
	wh, err := topoRepo.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "tr-wh", Name: "WH"})
	if err != nil {
		t.Fatal(err)
	}
	from, err := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "a", Name: "A"})
	if err != nil {
		t.Fatal(err)
	}
	to, err := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "b", Name: "B"})
	if err != nil {
		t.Fatal(err)
	}

	receiptHash := moveapp.HashPayload(map[string]any{
		"operation_type": "receipt",
		"lines":          []map[string]any{{"sku_id": sku.ID.String(), "quantity": 10, "to_location_id": from.ID.String()}},
	})
	_, err = moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpReceipt,
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 10, ToLocationID: &from.ID}},
		DeviceID:      "dev-transfer",
		OperationKey:  "rcpt-tr",
		PayloadHash:   receiptHash,
		CreatedBy:     "test",
	})
	if err != nil {
		t.Fatal(err)
	}

	transferHash := moveapp.HashPayload(map[string]any{
		"operation_type": "transfer",
		"lines": []map[string]any{{
			"sku_id": sku.ID.String(), "quantity": 4,
			"from_location_id": from.ID.String(), "to_location_id": to.ID.String(),
		}},
	})
	_, err = moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpTransfer,
		Lines: []movedomain.MovementLine{{
			SKUID: sku.ID, Quantity: 4, FromLocationID: &from.ID, ToLocationID: &to.ID,
		}},
		DeviceID: "dev-transfer", OperationKey: "xfer-tr", PayloadHash: transferHash, CreatedBy: "test",
	})
	if err != nil {
		t.Fatal(err)
	}

	var fromQty, toQty int
	if err := pool.QueryRow(ctx, `SELECT quantity FROM stock_balances WHERE sku_id=$1 AND location_id=$2`, sku.ID, from.ID).Scan(&fromQty); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT quantity FROM stock_balances WHERE sku_id=$1 AND location_id=$2`, sku.ID, to.ID).Scan(&toQty); err != nil {
		t.Fatal(err)
	}
	if fromQty != 6 || toQty != 4 {
		t.Fatalf("expected from=6 to=4, got from=%d to=%d", fromQty, toQty)
	}
}

func TestTransferIdempotentReplay(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	moveSvc := moveapp.NewMovementService(adapter)

	sku, err := skuRepo.Create(ctx, catalogdomain.CreateSKUInput{Name: "Transfer Idem SKU", Unit: "шт"})
	if err != nil {
		t.Fatal(err)
	}
	wh, err := topoRepo.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "tr-idem-wh", Name: "WH"})
	if err != nil {
		t.Fatal(err)
	}
	from, err := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "a", Name: "A"})
	if err != nil {
		t.Fatal(err)
	}
	to, err := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "b", Name: "B"})
	if err != nil {
		t.Fatal(err)
	}

	receiptHash := moveapp.HashPayload(map[string]any{
		"operation_type": "receipt",
		"lines":          []map[string]any{{"sku_id": sku.ID.String(), "quantity": 10, "to_location_id": from.ID.String()}},
	})
	_, err = moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpReceipt,
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 10, ToLocationID: &from.ID}},
		DeviceID:      "dev-transfer-idem",
		OperationKey:  "rcpt-tr-idem",
		PayloadHash:   receiptHash,
		CreatedBy:     "test",
	})
	if err != nil {
		t.Fatal(err)
	}

	transferHash := moveapp.HashPayload(map[string]any{
		"operation_type": "transfer",
		"reason_code":    "",
		"lines": []map[string]any{{
			"sku_id": sku.ID.String(), "quantity": 4,
			"from_location_id": from.ID.String(), "to_location_id": to.ID.String(),
		}},
	})
	input := movedomain.ApplyMovementInput{
		OperationType: movedomain.OpTransfer,
		Lines: []movedomain.MovementLine{{
			SKUID: sku.ID, Quantity: 4, FromLocationID: &from.ID, ToLocationID: &to.ID,
		}},
		DeviceID: "dev-transfer-idem", OperationKey: "xfer-tr-idem", PayloadHash: transferHash, CreatedBy: "test",
	}
	res1, err := moveSvc.Apply(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if !res1.Applied {
		t.Fatal("expected first transfer to apply")
	}
	res2, err := moveSvc.Apply(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if res2.Applied {
		t.Fatal("expected idempotent replay")
	}

	var fromQty, toQty int
	var movementCount int
	if err := pool.QueryRow(ctx, `SELECT quantity FROM stock_balances WHERE sku_id=$1 AND location_id=$2`, sku.ID, from.ID).Scan(&fromQty); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT quantity FROM stock_balances WHERE sku_id=$1 AND location_id=$2`, sku.ID, to.ID).Scan(&toQty); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM stock_movements WHERE operation_id=$1`, res1.OperationID).Scan(&movementCount); err != nil {
		t.Fatal(err)
	}
	if fromQty != 6 || toQty != 4 {
		t.Fatalf("expected from=6 to=4, got from=%d to=%d", fromQty, toQty)
	}
	if movementCount != 1 {
		t.Fatalf("expected 1 movement line, got %d", movementCount)
	}
}

func TestTransferConcurrentSameKey(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	moveSvc := moveapp.NewMovementService(adapter)

	sku, _ := skuRepo.Create(ctx, catalogdomain.CreateSKUInput{Name: "Concurrent SKU", Unit: "шт"})
	wh, _ := topoRepo.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "conc-wh", Name: "WH"})
	from, _ := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "a", Name: "A"})
	to, _ := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "b", Name: "B"})

	receiptHash := moveapp.HashPayload(map[string]any{
		"operation_type": "receipt",
		"lines":          []map[string]any{{"sku_id": sku.ID.String(), "quantity": 10, "to_location_id": from.ID.String()}},
	})
	_, err := moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpReceipt,
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 10, ToLocationID: &from.ID}},
		DeviceID:      "dev-conc", OperationKey: "rcpt-conc", PayloadHash: receiptHash, CreatedBy: "test",
	})
	if err != nil {
		t.Fatal(err)
	}

	transferHash := moveapp.HashPayload(map[string]any{
		"operation_type": "transfer",
		"reason_code":    "",
		"lines": []map[string]any{{
			"sku_id": sku.ID.String(), "quantity": 3,
			"from_location_id": from.ID.String(), "to_location_id": to.ID.String(),
		}},
	})
	input := movedomain.ApplyMovementInput{
		OperationType: movedomain.OpTransfer,
		Lines: []movedomain.MovementLine{{
			SKUID: sku.ID, Quantity: 3, FromLocationID: &from.ID, ToLocationID: &to.ID,
		}},
		DeviceID: "dev-conc", OperationKey: "xfer-conc", PayloadHash: transferHash, CreatedBy: "test",
	}

	type result struct {
		res *moveapp.ApplyResult
		err error
	}
	ch := make(chan result, 2)
	for i := 0; i < 2; i++ {
		go func() {
			res, err := moveSvc.Apply(ctx, input)
			ch <- result{res, err}
		}()
	}

	var applied int
	for i := 0; i < 2; i++ {
		out := <-ch
		if out.err != nil {
			t.Fatalf("concurrent apply: %v", out.err)
		}
		if out.res.Applied {
			applied++
		}
	}
	if applied != 1 {
		t.Fatalf("expected exactly one applied transfer, got %d", applied)
	}

	var fromQty, toQty int
	if err := pool.QueryRow(ctx, `SELECT quantity FROM stock_balances WHERE sku_id=$1 AND location_id=$2`, sku.ID, from.ID).Scan(&fromQty); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT quantity FROM stock_balances WHERE sku_id=$1 AND location_id=$2`, sku.ID, to.ID).Scan(&toQty); err != nil {
		t.Fatal(err)
	}
	if fromQty != 7 || toQty != 3 {
		t.Fatalf("expected from=7 to=3, got from=%d to=%d", fromQty, toQty)
	}
}

func TestIdempotencyPayloadMismatch(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	moveSvc := moveapp.NewMovementService(adapter)

	sku, _ := skuRepo.Create(ctx, catalogdomain.CreateSKUInput{Name: "Idem SKU", Unit: "шт"})
	wh, _ := topoRepo.CreateWarehouse(ctx, topologydomain.CreateWarehouseInput{Code: "idem-wh", Name: "WH"})
	loc, _ := topoRepo.CreateLocation(ctx, topologydomain.CreateLocationInput{WarehouseID: wh.ID, Code: "l1", Name: "L1"})

	hash1 := moveapp.HashPayload(map[string]any{
		"operation_type": "receipt",
		"lines":          []map[string]any{{"sku_id": sku.ID.String(), "quantity": 5, "to_location_id": loc.ID.String()}},
	})
	_, err := moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpReceipt,
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 5, ToLocationID: &loc.ID}},
		DeviceID:      "dev-idem", OperationKey: "same-key", PayloadHash: hash1, CreatedBy: "test",
	})
	if err != nil {
		t.Fatal(err)
	}

	hash2 := moveapp.HashPayload(map[string]any{
		"operation_type": "receipt",
		"lines":          []map[string]any{{"sku_id": sku.ID.String(), "quantity": 9, "to_location_id": loc.ID.String()}},
	})
	_, err = moveSvc.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OpReceipt,
		Lines:         []movedomain.MovementLine{{SKUID: sku.ID, Quantity: 9, ToLocationID: &loc.ID}},
		DeviceID:      "dev-idem", OperationKey: "same-key", PayloadHash: hash2, CreatedBy: "test",
	})
	if err == nil {
		t.Fatal("expected idempotency payload mismatch")
	}
	if ae, ok := err.(*apperr.AppError); !ok || ae.Code != "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH" {
		t.Fatalf("expected IDEMPOTENCY_KEY_PAYLOAD_MISMATCH, got %v", err)
	}
}
