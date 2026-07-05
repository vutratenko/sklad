package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vutratenko/sklad/internal/modules/topology/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
	"github.com/vutratenko/sklad/internal/shared/postgres"
)

type TopologyRepository struct {
	pool postgres.Pool
}

func NewTopologyRepository(pool postgres.Pool) *TopologyRepository {
	return &TopologyRepository{pool: pool}
}

func (r *TopologyRepository) CreateWarehouse(ctx context.Context, in domain.CreateWarehouseInput) (*domain.Warehouse, error) {
	var w domain.Warehouse
	err := r.pool.QueryRow(ctx, `
		INSERT INTO warehouses (code, name) VALUES ($1, $2)
		RETURNING id, code, name, is_active, created_at, updated_at
	`, in.Code, in.Name).Scan(&w.ID, &w.Code, &w.Name, &w.IsActive, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("DUPLICATE_WAREHOUSE_CODE", "warehouse code already exists")
		}
		return nil, fmt.Errorf("create warehouse: %w", err)
	}
	return &w, nil
}

func (r *TopologyRepository) GetWarehouse(ctx context.Context, id uuid.UUID) (*domain.Warehouse, error) {
	var w domain.Warehouse
	err := r.pool.QueryRow(ctx, `
		SELECT id, code, name, is_active, created_at, updated_at FROM warehouses WHERE id = $1
	`, id).Scan(&w.ID, &w.Code, &w.Name, &w.IsActive, &w.CreatedAt, &w.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("warehouse not found")
	}
	return &w, err
}

func (r *TopologyRepository) ListWarehouses(ctx context.Context, activeOnly bool) ([]domain.Warehouse, error) {
	query := `SELECT id, code, name, is_active, created_at, updated_at FROM warehouses`
	if activeOnly {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWarehouses(rows)
}

func (r *TopologyRepository) UpdateWarehouse(ctx context.Context, id uuid.UUID, in domain.UpdateWarehouseInput) (*domain.Warehouse, error) {
	w, err := r.GetWarehouse(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.Code != nil {
		w.Code = *in.Code
	}
	if in.Name != nil {
		w.Name = *in.Name
	}
	if in.IsActive != nil {
		w.IsActive = *in.IsActive
	}
	err = r.pool.QueryRow(ctx, `
		UPDATE warehouses SET code=$2, name=$3, is_active=$4, updated_at=now()
		WHERE id=$1
		RETURNING updated_at
	`, id, w.Code, w.Name, w.IsActive).Scan(&w.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("DUPLICATE_WAREHOUSE_CODE", "warehouse code already exists")
		}
		return nil, err
	}
	return w, nil
}

func (r *TopologyRepository) DeleteWarehouse(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `UPDATE warehouses SET is_active=false, updated_at=now() WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("warehouse not found")
	}
	return nil
}

func (r *TopologyRepository) CreateLocation(ctx context.Context, in domain.CreateLocationInput) (*domain.Location, error) {
	var loc domain.Location
	err := r.pool.QueryRow(ctx, `
		INSERT INTO locations (warehouse_id, code, name) VALUES ($1, $2, $3)
		RETURNING id, warehouse_id, code, name, is_active, created_at, updated_at
	`, in.WarehouseID, in.Code, in.Name).Scan(
		&loc.ID, &loc.WarehouseID, &loc.Code, &loc.Name, &loc.IsActive, &loc.CreatedAt, &loc.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("DUPLICATE_LOCATION_CODE", "location code already exists in warehouse")
		}
		return nil, fmt.Errorf("create location: %w", err)
	}
	return &loc, nil
}

func (r *TopologyRepository) GetLocation(ctx context.Context, id uuid.UUID) (*domain.Location, error) {
	var loc domain.Location
	err := r.pool.QueryRow(ctx, `
		SELECT id, warehouse_id, code, name, is_active, created_at, updated_at
		FROM locations WHERE id = $1
	`, id).Scan(&loc.ID, &loc.WarehouseID, &loc.Code, &loc.Name, &loc.IsActive, &loc.CreatedAt, &loc.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("location not found")
	}
	return &loc, err
}

func (r *TopologyRepository) ListLocations(ctx context.Context, warehouseID uuid.UUID, activeOnly bool) ([]domain.Location, error) {
	query := `
		SELECT id, warehouse_id, code, name, is_active, created_at, updated_at
		FROM locations WHERE warehouse_id = $1`
	if activeOnly {
		query += ` AND is_active = true`
	}
	query += ` ORDER BY code`
	rows, err := r.pool.Query(ctx, query, warehouseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanLocations(rows)
}

func (r *TopologyRepository) UpdateLocation(ctx context.Context, id uuid.UUID, in domain.UpdateLocationInput) (*domain.Location, error) {
	loc, err := r.GetLocation(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.Code != nil {
		loc.Code = *in.Code
	}
	if in.Name != nil {
		loc.Name = *in.Name
	}
	if in.IsActive != nil {
		loc.IsActive = *in.IsActive
	}
	err = r.pool.QueryRow(ctx, `
		UPDATE locations SET code=$2, name=$3, is_active=$4, updated_at=now()
		WHERE id=$1
		RETURNING updated_at
	`, id, loc.Code, loc.Name, loc.IsActive).Scan(&loc.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("DUPLICATE_LOCATION_CODE", "location code already exists in warehouse")
		}
		return nil, err
	}
	return loc, nil
}

func (r *TopologyRepository) DeleteLocation(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `UPDATE locations SET is_active=false, updated_at=now() WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("location not found")
	}
	return nil
}

func scanWarehouses(rows pgxRows) ([]domain.Warehouse, error) {
	var result []domain.Warehouse
	for rows.Next() {
		var w domain.Warehouse
		if err := rows.Scan(&w.ID, &w.Code, &w.Name, &w.IsActive, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, w)
	}
	return result, rows.Err()
}

func scanLocations(rows pgxRows) ([]domain.Location, error) {
	var result []domain.Location
	for rows.Next() {
		var loc domain.Location
		if err := rows.Scan(&loc.ID, &loc.WarehouseID, &loc.Code, &loc.Name, &loc.IsActive, &loc.CreatedAt, &loc.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, loc)
	}
	return result, rows.Err()
}

type pgxRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
	Close()
}

func isUniqueViolation(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique")
}
