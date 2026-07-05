package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Lot struct {
	ID             uuid.UUID
	SKUID          uuid.UUID
	LotCode        string
	ProductionDate *time.Time
	ExpiryDate     *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type CreateLotInput struct {
	SKUID          uuid.UUID
	LotCode        string
	ProductionDate *time.Time
	ExpiryDate     *time.Time
}

type Repository interface {
	Create(ctx context.Context, in CreateLotInput) (*Lot, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Lot, error)
	List(ctx context.Context, skuID *uuid.UUID) ([]Lot, error)
}
