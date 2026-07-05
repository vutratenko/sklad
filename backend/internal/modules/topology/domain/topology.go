package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Warehouse struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Location struct {
	ID          uuid.UUID `json:"id"`
	WarehouseID uuid.UUID `json:"warehouse_id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateWarehouseInput struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type UpdateWarehouseInput struct {
	Code     *string `json:"code"`
	Name     *string `json:"name"`
	IsActive *bool   `json:"is_active"`
}

type CreateLocationInput struct {
	WarehouseID uuid.UUID `json:"warehouse_id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
}

type UpdateLocationInput struct {
	Code     *string `json:"code"`
	Name     *string `json:"name"`
	IsActive *bool   `json:"is_active"`
}

type Repository interface {
	CreateWarehouse(ctx context.Context, in CreateWarehouseInput) (*Warehouse, error)
	GetWarehouse(ctx context.Context, id uuid.UUID) (*Warehouse, error)
	ListWarehouses(ctx context.Context, activeOnly bool) ([]Warehouse, error)
	UpdateWarehouse(ctx context.Context, id uuid.UUID, in UpdateWarehouseInput) (*Warehouse, error)
	DeleteWarehouse(ctx context.Context, id uuid.UUID) error

	CreateLocation(ctx context.Context, in CreateLocationInput) (*Location, error)
	GetLocation(ctx context.Context, id uuid.UUID) (*Location, error)
	ListLocations(ctx context.Context, warehouseID uuid.UUID, activeOnly bool) ([]Location, error)
	UpdateLocation(ctx context.Context, id uuid.UUID, in UpdateLocationInput) (*Location, error)
	DeleteLocation(ctx context.Context, id uuid.UUID) error
}
