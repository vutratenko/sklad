package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type SKU struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	PhotoURL    string    `json:"photo_url"`
	Unit        string    `json:"unit"`
	IsActive    bool      `json:"is_active"`
	Barcodes    []string  `json:"barcodes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateSKUInput struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	PhotoURL    string   `json:"photo_url"`
	Unit        string   `json:"unit"`
	Barcodes    []string `json:"barcodes"`
}

type UpdateSKUInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	PhotoURL    *string `json:"photo_url"`
	Unit        *string `json:"unit"`
	IsActive    *bool   `json:"is_active"`
}

type AddBarcodeInput struct {
	Barcode string `json:"barcode"`
}

type Repository interface {
	Create(ctx context.Context, in CreateSKUInput) (*SKU, error)
	GetByID(ctx context.Context, id uuid.UUID) (*SKU, error)
	List(ctx context.Context, q string, activeOnly bool) ([]SKU, error)
	Update(ctx context.Context, id uuid.UUID, in UpdateSKUInput) (*SKU, error)
	Delete(ctx context.Context, id uuid.UUID) error
	FindByBarcode(ctx context.Context, barcode string) (*SKU, error)
	NextBarcode(ctx context.Context) (string, error)
	AddBarcode(ctx context.Context, skuID uuid.UUID, barcode string) error
	RemoveBarcode(ctx context.Context, skuID uuid.UUID, barcode string) error
}
