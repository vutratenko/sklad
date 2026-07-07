//go:build integration

package integration_test

import (
	"testing"

	catalogapp "github.com/vutratenko/sklad/internal/modules/catalog/application"
	catalogdomain "github.com/vutratenko/sklad/internal/modules/catalog/domain"
	catalogpg "github.com/vutratenko/sklad/internal/modules/catalog/infrastructure/postgres"
	sharedpg "github.com/vutratenko/sklad/internal/shared/postgres"
	"github.com/vutratenko/sklad/internal/testutil"
)

func TestCatalogCRUD(t *testing.T) {
	ctx, pool := testutil.ConnectAndMigrate(t)
	svc := catalogapp.NewCatalogService(catalogpg.NewSKURepository(&sharedpg.PoolAdapter{Pool: pool.Pool}))

	sku, err := svc.Create(ctx, catalogdomain.CreateSKUInput{
		Name:     "Tomato paste",
		Category: "canned",
		Unit:     "шт",
	})
	if err != nil {
		t.Fatal(err)
	}

	got, err := svc.Get(ctx, sku.ID.String())
	if err != nil || got.Name != "Tomato paste" || len(got.Barcodes) != 1 || got.Barcodes[0] != "000001" {
		t.Fatalf("get sku: %v %+v", err, got)
	}

	name := "Tomato paste 400g"
	updated, err := svc.Update(ctx, sku.ID.String(), catalogdomain.UpdateSKUInput{Name: &name})
	if err != nil || updated.Name != name {
		t.Fatalf("update sku: %v", err)
	}

	_, err = svc.AddBarcode(ctx, sku.ID.String(), "000002")
	if err == nil {
		t.Fatal("expected add barcode to reject second code")
	}

	byBarcode, err := svc.FindByBarcode(ctx, "000001")
	if err != nil || byBarcode.ID != sku.ID {
		t.Fatalf("find by barcode: %v", err)
	}

	updated, err = svc.RemoveBarcode(ctx, sku.ID.String(), "000001")
	if err != nil || len(updated.Barcodes) != 0 {
		t.Fatalf("remove barcode: %v len=%d", err, len(updated.Barcodes))
	}

	if err := svc.Delete(ctx, sku.ID.String()); err != nil {
		t.Fatal(err)
	}

	active, err := svc.List(ctx, "", true)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range active {
		if item.ID == sku.ID {
			t.Fatal("deleted sku should not appear in active list")
		}
	}
}
