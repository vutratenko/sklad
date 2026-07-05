package postgres

import (
	"context"

	"github.com/vutratenko/sklad/internal/modules/stockview/domain"
	"github.com/vutratenko/sklad/internal/shared/postgres"
)

type StockViewRepository struct {
	pool postgres.Pool
}

func NewStockViewRepository(pool postgres.Pool) *StockViewRepository {
	return &StockViewRepository{pool: pool}
}

func (r *StockViewRepository) ListStocks(ctx context.Context, f domain.StockFilter) ([]domain.StockBalance, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT sb.id, sb.sku_id, s.name, s.photo_url, s.unit, sb.warehouse_id, w.name,
		       sb.location_id, l.name, sb.lot_id, lt.lot_code, lt.expiry_date,
		       sb.quantity, sb.updated_at
		FROM stock_balances sb
		JOIN skus s ON s.id = sb.sku_id
		JOIN warehouses w ON w.id = sb.warehouse_id
		JOIN locations l ON l.id = sb.location_id
		LEFT JOIN lots lt ON lt.id = sb.lot_id
		WHERE sb.quantity > 0
		  AND ($1::uuid IS NULL OR sb.sku_id = $1)
		  AND ($2::uuid IS NULL OR sb.warehouse_id = $2)
		  AND ($3::uuid IS NULL OR sb.location_id = $3)
		  AND ($4::uuid IS NULL OR sb.lot_id = $4)
		  AND ($5 = '' OR s.name ILIKE '%' || $5 || '%')
		ORDER BY s.name, w.name, l.code
	`, f.SKUID, f.WarehouseID, f.LocationID, f.LotID, f.Query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.StockBalance
	for rows.Next() {
		var sb domain.StockBalance
		if err := rows.Scan(
			&sb.ID, &sb.SKUID, &sb.SKUName, &sb.PhotoURL, &sb.SKUUnit, &sb.WarehouseID, &sb.Warehouse,
			&sb.LocationID, &sb.Location, &sb.LotID, &sb.LotCode, &sb.ExpiryDate,
			&sb.Quantity, &sb.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, sb)
	}
	return result, rows.Err()
}

func (r *StockViewRepository) ListMovements(ctx context.Context, f domain.MovementFilter) ([]domain.MovementRecord, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		SELECT sm.id, sm.operation_id, o.operation_type::text, o.reason_code,
		       sm.sku_id, s.name, sm.lot_id, sm.quantity,
		       sm.from_location_id, sm.to_location_id, sm.occurred_at
		FROM stock_movements sm
		JOIN operations o ON o.id = sm.operation_id
		JOIN skus s ON s.id = sm.sku_id
		WHERE ($1::uuid IS NULL OR sm.sku_id = $1)
		  AND ($2 = '' OR o.operation_type::text = $2)
		ORDER BY sm.occurred_at DESC
		LIMIT $3
	`, f.SKUID, ptrStr(f.OperationType), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.MovementRecord
	for rows.Next() {
		var m domain.MovementRecord
		if err := rows.Scan(
			&m.ID, &m.OperationID, &m.OperationType, &m.ReasonCode,
			&m.SKUID, &m.SKUName, &m.LotID, &m.Quantity,
			&m.FromLocationID, &m.ToLocationID, &m.OccurredAt,
		); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
