package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vutratenko/sklad/internal/modules/lots/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
	"github.com/vutratenko/sklad/internal/shared/postgres"
)

type LotRepository struct {
	pool postgres.Pool
}

func NewLotRepository(pool postgres.Pool) *LotRepository {
	return &LotRepository{pool: pool}
}

func (r *LotRepository) Create(ctx context.Context, in domain.CreateLotInput) (*domain.Lot, error) {
	var lot domain.Lot
	err := r.pool.QueryRow(ctx, `
		INSERT INTO lots (sku_id, lot_code, production_date, expiry_date)
		VALUES ($1, $2, $3, $4)
		RETURNING id, sku_id, lot_code, production_date, expiry_date, created_at, updated_at
	`, in.SKUID, in.LotCode, in.ProductionDate, in.ExpiryDate).Scan(
		&lot.ID, &lot.SKUID, &lot.LotCode, &lot.ProductionDate, &lot.ExpiryDate, &lot.CreatedAt, &lot.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create lot: %w", err)
	}
	return &lot, nil
}

func (r *LotRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Lot, error) {
	var lot domain.Lot
	err := r.pool.QueryRow(ctx, `
		SELECT id, sku_id, lot_code, production_date, expiry_date, created_at, updated_at
		FROM lots WHERE id = $1
	`, id).Scan(&lot.ID, &lot.SKUID, &lot.LotCode, &lot.ProductionDate, &lot.ExpiryDate, &lot.CreatedAt, &lot.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("lot not found")
	}
	return &lot, err
}

func (r *LotRepository) List(ctx context.Context, skuID *uuid.UUID) ([]domain.Lot, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, sku_id, lot_code, production_date, expiry_date, created_at, updated_at
		FROM lots
		WHERE ($1::uuid IS NULL OR sku_id = $1)
		ORDER BY expiry_date NULLS LAST
	`, skuID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.Lot
	for rows.Next() {
		var lot domain.Lot
		if err := rows.Scan(&lot.ID, &lot.SKUID, &lot.LotCode, &lot.ProductionDate, &lot.ExpiryDate, &lot.CreatedAt, &lot.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, lot)
	}
	return result, rows.Err()
}
