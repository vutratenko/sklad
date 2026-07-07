package application

import (
	"context"
	"fmt"
	"strings"

	catalogdomain "github.com/vutratenko/sklad/internal/modules/catalog/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type CatalogService struct {
	repo catalogdomain.Repository
}

func NewCatalogService(repo catalogdomain.Repository) *CatalogService {
	return &CatalogService{repo: repo}
}

func (s *CatalogService) Create(ctx context.Context, in catalogdomain.CreateSKUInput) (*catalogdomain.SKU, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, apperr.Validation("name is required")
	}
	in.Unit = defaultStr(in.Unit, "шт")
	barcode, err := s.repo.NextBarcode(ctx)
	if err != nil {
		return nil, err
	}
	in.Barcodes = []string{barcode}
	return s.repo.Create(ctx, in)
}

func (s *CatalogService) Get(ctx context.Context, id string) (*catalogdomain.SKU, error) {
	uid, err := parseUUID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, uid)
}

func FormatSKUBarcode(n int) (string, error) {
	if n < 1 || n > 999999 {
		return "", apperr.Validation("barcode sequence is exhausted")
	}
	return fmt.Sprintf("%06d", n), nil
}

func (s *CatalogService) List(ctx context.Context, q string, activeOnly bool) ([]catalogdomain.SKU, error) {
	return s.repo.List(ctx, q, activeOnly)
}

func (s *CatalogService) Update(ctx context.Context, id string, in catalogdomain.UpdateSKUInput) (*catalogdomain.SKU, error) {
	uid, err := parseUUID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, uid, in)
}

func (s *CatalogService) Delete(ctx context.Context, id string) error {
	uid, err := parseUUID(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, uid)
}

func (s *CatalogService) FindByBarcode(ctx context.Context, barcode string) (*catalogdomain.SKU, error) {
	barcode = strings.TrimSpace(barcode)
	if barcode == "" {
		return nil, apperr.Validation("barcode is required")
	}
	return s.repo.FindByBarcode(ctx, barcode)
}

func (s *CatalogService) AddBarcode(ctx context.Context, skuID string, barcode string) (*catalogdomain.SKU, error) {
	uid, err := parseUUID(skuID)
	if err != nil {
		return nil, err
	}
	barcode = strings.TrimSpace(barcode)
	if barcode == "" {
		return nil, apperr.Validation("barcode is required")
	}
	sku, err := s.repo.GetByID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if len(sku.Barcodes) > 0 {
		return nil, apperr.Validation("sku already has barcode")
	}
	if err := s.repo.AddBarcode(ctx, uid, barcode); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, uid)
}

func (s *CatalogService) RemoveBarcode(ctx context.Context, skuID string, barcode string) (*catalogdomain.SKU, error) {
	uid, err := parseUUID(skuID)
	if err != nil {
		return nil, err
	}
	barcode = strings.TrimSpace(barcode)
	if barcode == "" {
		return nil, apperr.Validation("barcode is required")
	}
	if err := s.repo.RemoveBarcode(ctx, uid, barcode); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, uid)
}

func defaultStr(s, d string) string {
	if s == "" {
		return d
	}
	return s
}
