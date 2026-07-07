package application_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	catalogapp "github.com/vutratenko/sklad/internal/modules/catalog/application"
	catalogdomain "github.com/vutratenko/sklad/internal/modules/catalog/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type fakeRepo struct {
	skus     map[uuid.UUID]*catalogdomain.SKU
	barcodes map[string]uuid.UUID
}

func (f *fakeRepo) Create(_ context.Context, in catalogdomain.CreateSKUInput) (*catalogdomain.SKU, error) {
	sku := &catalogdomain.SKU{
		ID:          uuid.New(),
		Name:        in.Name,
		Description: in.Description,
		Category:    in.Category,
		PhotoURL:    in.PhotoURL,
		Unit:        in.Unit,
		IsActive:    true,
	}
	f.skus[sku.ID] = sku
	for _, bc := range in.Barcodes {
		if bc == "" {
			continue
		}
		if err := f.AddBarcode(context.Background(), sku.ID, bc); err != nil {
			return nil, err
		}
	}
	return sku, nil
}

func (f *fakeRepo) GetByID(_ context.Context, id uuid.UUID) (*catalogdomain.SKU, error) {
	sku, ok := f.skus[id]
	if !ok {
		return nil, apperr.NotFound("sku not found")
	}
	out := *sku
	return &out, nil
}

func (f *fakeRepo) List(_ context.Context, q string, activeOnly bool) ([]catalogdomain.SKU, error) {
	var out []catalogdomain.SKU
	for _, sku := range f.skus {
		if activeOnly && !sku.IsActive {
			continue
		}
		out = append(out, *sku)
	}
	return out, nil
}

func (f *fakeRepo) Update(_ context.Context, id uuid.UUID, in catalogdomain.UpdateSKUInput) (*catalogdomain.SKU, error) {
	sku, err := f.GetByID(context.Background(), id)
	if err != nil {
		return nil, err
	}
	if in.Name != nil {
		sku.Name = *in.Name
	}
	if in.IsActive != nil {
		sku.IsActive = *in.IsActive
	}
	f.skus[id] = sku
	return sku, nil
}

func (f *fakeRepo) Delete(_ context.Context, id uuid.UUID) error {
	sku, err := f.GetByID(context.Background(), id)
	if err != nil {
		return err
	}
	sku.IsActive = false
	f.skus[id] = sku
	return nil
}

func (f *fakeRepo) FindByBarcode(_ context.Context, barcode string) (*catalogdomain.SKU, error) {
	id, ok := f.barcodes[barcode]
	if !ok {
		return nil, apperr.NotFound("barcode not found")
	}
	return f.GetByID(context.Background(), id)
}

func (f *fakeRepo) NextBarcode(_ context.Context) (string, error) {
	max := 0
	for barcode := range f.barcodes {
		if len(barcode) != 6 {
			continue
		}
		n := 0
		ok := true
		for _, ch := range barcode {
			if ch < '0' || ch > '9' {
				ok = false
				break
			}
			n = n*10 + int(ch-'0')
		}
		if ok && n > max {
			max = n
		}
	}
	return catalogapp.FormatSKUBarcode(max + 1)
}

func (f *fakeRepo) AddBarcode(_ context.Context, skuID uuid.UUID, barcode string) error {
	if _, ok := f.barcodes[barcode]; ok {
		return apperr.DuplicateBarcode()
	}
	f.barcodes[barcode] = skuID
	sku := f.skus[skuID]
	sku.Barcodes = append(sku.Barcodes, barcode)
	return nil
}

func (f *fakeRepo) RemoveBarcode(_ context.Context, skuID uuid.UUID, barcode string) error {
	if f.barcodes[barcode] != skuID {
		return apperr.NotFound("barcode not found")
	}
	delete(f.barcodes, barcode)
	sku := f.skus[skuID]
	var next []string
	for _, bc := range sku.Barcodes {
		if bc != barcode {
			next = append(next, bc)
		}
	}
	sku.Barcodes = next
	return nil
}

func TestCreateSKU_Validation(t *testing.T) {
	svc := catalogapp.NewCatalogService(&fakeRepo{skus: map[uuid.UUID]*catalogdomain.SKU{}, barcodes: map[string]uuid.UUID{}})
	_, err := svc.Create(context.Background(), catalogdomain.CreateSKUInput{})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestCreateSKU_AssignsSingleAutoBarcode(t *testing.T) {
	repo := &fakeRepo{skus: map[uuid.UUID]*catalogdomain.SKU{}, barcodes: map[string]uuid.UUID{}}
	svc := catalogapp.NewCatalogService(repo)

	first, err := svc.Create(context.Background(), catalogdomain.CreateSKUInput{Name: "Tomato", Barcodes: []string{"999999"}})
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.Create(context.Background(), catalogdomain.CreateSKUInput{Name: "Jam"})
	if err != nil {
		t.Fatal(err)
	}

	if got := first.Barcodes; len(got) != 1 || got[0] != "000001" {
		t.Fatalf("expected first generated barcode 000001, got %#v", got)
	}
	if got := second.Barcodes; len(got) != 1 || got[0] != "000002" {
		t.Fatalf("expected second generated barcode 000002, got %#v", got)
	}
}

func TestFormatSKUBarcode(t *testing.T) {
	got, err := catalogapp.FormatSKUBarcode(42)
	if err != nil {
		t.Fatal(err)
	}
	if got != "000042" {
		t.Fatalf("expected 000042, got %q", got)
	}
	if _, err := catalogapp.FormatSKUBarcode(1000000); err == nil {
		t.Fatal("expected sequence exhaustion error")
	}
}

func TestAddBarcode_RejectsSecondBarcode(t *testing.T) {
	repo := &fakeRepo{skus: map[uuid.UUID]*catalogdomain.SKU{}, barcodes: map[string]uuid.UUID{}}
	svc := catalogapp.NewCatalogService(repo)
	sku, err := svc.Create(context.Background(), catalogdomain.CreateSKUInput{Name: "Tomato"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.AddBarcode(context.Background(), sku.ID.String(), "456")
	if err == nil {
		t.Fatal("expected validation error for second barcode")
	}
}

func TestDeleteSKU_SoftDelete(t *testing.T) {
	repo := &fakeRepo{skus: map[uuid.UUID]*catalogdomain.SKU{}, barcodes: map[string]uuid.UUID{}}
	svc := catalogapp.NewCatalogService(repo)
	sku, _ := svc.Create(context.Background(), catalogdomain.CreateSKUInput{Name: "Jam"})
	if err := svc.Delete(context.Background(), sku.ID.String()); err != nil {
		t.Fatal(err)
	}
	active, _ := svc.List(context.Background(), "", true)
	for _, item := range active {
		if item.ID == sku.ID {
			t.Fatal("deleted sku should not appear in active list")
		}
	}
}
