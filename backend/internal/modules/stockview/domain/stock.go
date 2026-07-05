package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type StockBalance struct {
	ID          uuid.UUID  `json:"id"`
	SKUID       uuid.UUID  `json:"sku_id"`
	SKUName     string     `json:"sku_name"`
	PhotoURL    string     `json:"photo_url"`
	SKUUnit     string     `json:"unit"`
	WarehouseID uuid.UUID  `json:"warehouse_id"`
	Warehouse   string     `json:"warehouse"`
	LocationID  uuid.UUID  `json:"location_id"`
	Location    string     `json:"location"`
	LotID       *uuid.UUID `json:"lot_id,omitempty"`
	LotCode     *string    `json:"lot_code,omitempty"`
	ExpiryDate  *time.Time `json:"expiry_date,omitempty"`
	Quantity    int        `json:"quantity"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type MovementRecord struct {
	ID             uuid.UUID  `json:"id"`
	OperationID    uuid.UUID  `json:"operation_id"`
	OperationType  string     `json:"operation_type"`
	ReasonCode     *string    `json:"reason_code,omitempty"`
	SKUID          uuid.UUID  `json:"sku_id"`
	SKUName        string     `json:"sku_name"`
	LotID          *uuid.UUID `json:"lot_id,omitempty"`
	Quantity       int        `json:"quantity"`
	FromLocationID *uuid.UUID `json:"from_location_id,omitempty"`
	ToLocationID   *uuid.UUID `json:"to_location_id,omitempty"`
	OccurredAt     time.Time  `json:"occurred_at"`
}

type StockFilter struct {
	SKUID       *uuid.UUID
	WarehouseID *uuid.UUID
	LocationID  *uuid.UUID
	LotID       *uuid.UUID
	Query       string
}

type MovementFilter struct {
	SKUID         *uuid.UUID
	OperationType *string
	Limit         int
}

type Repository interface {
	ListStocks(ctx context.Context, f StockFilter) ([]StockBalance, error)
	ListMovements(ctx context.Context, f MovementFilter) ([]MovementRecord, error)
}
