package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/vutratenko/sklad/internal/modules/catalog/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
	"github.com/vutratenko/sklad/internal/shared/postgres"
)

type SKURepository struct {
	pool postgres.Pool
}

func NewSKURepository(pool postgres.Pool) *SKURepository {
	return &SKURepository{pool: pool}
}

func (r *SKURepository) Create(ctx context.Context, in domain.CreateSKUInput) (*domain.SKU, error) {
	var sku domain.SKU
	err := r.pool.QueryRow(ctx, `
		INSERT INTO skus (name, description, category, photo_url, unit)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, description, category, photo_url, unit, is_active, created_at, updated_at
	`, in.Name, in.Description, in.Category, in.PhotoURL, in.Unit).Scan(
		&sku.ID, &sku.Name, &sku.Description, &sku.Category, &sku.PhotoURL, &sku.Unit, &sku.IsActive, &sku.CreatedAt, &sku.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create sku: %w", err)
	}
	for _, bc := range in.Barcodes {
		bc = trimBarcode(bc)
		if bc == "" {
			continue
		}
		if err := r.AddBarcode(ctx, sku.ID, bc); err != nil {
			return nil, err
		}
		sku.Barcodes = append(sku.Barcodes, bc)
	}
	return &sku, nil
}

func (r *SKURepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.SKU, error) {
	var sku domain.SKU
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, description, category, photo_url, unit, is_active, created_at, updated_at
		FROM skus WHERE id = $1
	`, id).Scan(&sku.ID, &sku.Name, &sku.Description, &sku.Category, &sku.PhotoURL, &sku.Unit, &sku.IsActive, &sku.CreatedAt, &sku.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("sku not found")
	}
	if err != nil {
		return nil, err
	}
	sku.Barcodes, _ = r.listBarcodes(ctx, id)
	return &sku, nil
}

func (r *SKURepository) List(ctx context.Context, q string, activeOnly bool) ([]domain.SKU, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, description, category, photo_url, unit, is_active, created_at, updated_at
		FROM skus
		WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR category ILIKE '%' || $1 || '%')
		  AND ($2 = false OR is_active = true)
		ORDER BY name
	`, q, activeOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.SKU
	for rows.Next() {
		var sku domain.SKU
		if err := rows.Scan(&sku.ID, &sku.Name, &sku.Description, &sku.Category, &sku.PhotoURL, &sku.Unit, &sku.IsActive, &sku.CreatedAt, &sku.UpdatedAt); err != nil {
			return nil, err
		}
		sku.Barcodes, _ = r.listBarcodes(ctx, sku.ID)
		result = append(result, sku)
	}
	return result, rows.Err()
}

func (r *SKURepository) Update(ctx context.Context, id uuid.UUID, in domain.UpdateSKUInput) (*domain.SKU, error) {
	sku, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.Name != nil {
		sku.Name = *in.Name
	}
	if in.Description != nil {
		sku.Description = *in.Description
	}
	if in.Category != nil {
		sku.Category = *in.Category
	}
	if in.PhotoURL != nil {
		sku.PhotoURL = *in.PhotoURL
	}
	if in.Unit != nil {
		sku.Unit = *in.Unit
	}
	if in.IsActive != nil {
		sku.IsActive = *in.IsActive
	}
	err = r.pool.QueryRow(ctx, `
		UPDATE skus SET name=$2, description=$3, category=$4, photo_url=$5, unit=$6, is_active=$7, updated_at=now()
		WHERE id=$1
		RETURNING updated_at
	`, id, sku.Name, sku.Description, sku.Category, sku.PhotoURL, sku.Unit, sku.IsActive).Scan(&sku.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return sku, nil
}

func (r *SKURepository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE skus SET is_active = false, updated_at = now() WHERE id = $1
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("sku not found")
	}
	return nil
}

func (r *SKURepository) FindByBarcode(ctx context.Context, barcode string) (*domain.SKU, error) {
	var skuID uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT sku_id FROM sku_barcodes WHERE barcode = $1`, barcode).Scan(&skuID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("barcode not found")
	}
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, skuID)
}

func (r *SKURepository) NextBarcode(ctx context.Context) (string, error) {
	var next int
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(barcode::integer), 0) + 1
		FROM sku_barcodes
		WHERE barcode ~ '^[0-9]{6}$'
	`).Scan(&next)
	if err != nil {
		return "", err
	}
	if next < 1 || next > 999999 {
		return "", apperr.Validation("barcode sequence is exhausted")
	}
	return fmt.Sprintf("%06d", next), nil
}

func (r *SKURepository) AddBarcode(ctx context.Context, skuID uuid.UUID, barcode string) error {
	barcode = trimBarcode(barcode)
	_, err := r.pool.Exec(ctx, `INSERT INTO sku_barcodes (sku_id, barcode) VALUES ($1, $2)`, skuID, barcode)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return apperr.DuplicateBarcode()
		}
		return err
	}
	return nil
}

func (r *SKURepository) RemoveBarcode(ctx context.Context, skuID uuid.UUID, barcode string) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM sku_barcodes WHERE sku_id = $1 AND barcode = $2
	`, skuID, trimBarcode(barcode))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("barcode not found")
	}
	return nil
}

func (r *SKURepository) listBarcodes(ctx context.Context, skuID uuid.UUID) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT barcode FROM sku_barcodes WHERE sku_id = $1 ORDER BY barcode`, skuID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var codes []string
	for rows.Next() {
		var bc string
		if err := rows.Scan(&bc); err != nil {
			return nil, err
		}
		codes = append(codes, bc)
	}
	return codes, rows.Err()
}

func trimBarcode(s string) string {
	return strings.TrimSpace(s)
}
