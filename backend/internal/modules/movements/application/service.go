package application

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vutratenko/sklad/internal/modules/movements/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type TxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

type MovementService struct {
	db TxBeginner
}

func NewMovementService(db TxBeginner) *MovementService {
	return &MovementService{db: db}
}

type ApplyResult struct {
	OperationID uuid.UUID
	MovementIDs []uuid.UUID
	Applied     bool
}

func HashPayload(v any) string {
	b, _ := json.Marshal(v)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func (s *MovementService) Apply(ctx context.Context, in domain.ApplyMovementInput) (*ApplyResult, error) {
	if err := domain.ValidateMovementInput(in); err != nil {
		return nil, apperr.Validation(err.Error())
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var existingID uuid.UUID
	var existingHash string
	err = tx.QueryRow(ctx, `
		SELECT id, payload_hash FROM operations
		WHERE source_device_id = $1 AND operation_key = $2
	`, in.DeviceID, in.OperationKey).Scan(&existingID, &existingHash)
	if err == nil {
		if existingHash != in.PayloadHash {
			return nil, apperr.IdempotencyMismatch()
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return &ApplyResult{OperationID: existingID, Applied: false}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	effectiveAt := in.EffectiveAt
	if effectiveAt.IsZero() {
		effectiveAt = time.Now().UTC()
	}

	var opID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO operations (operation_type, reason_code, source_device_id, operation_key, payload_hash, created_by, effective_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, in.OperationType, nullStr(in.ReasonCode), in.DeviceID, in.OperationKey, in.PayloadHash, in.CreatedBy, effectiveAt).Scan(&opID)
	if err != nil {
		return nil, fmt.Errorf("insert operation: %w", err)
	}

	var movementIDs []uuid.UUID
	for _, line := range in.Lines {
		mid, err := s.applyLine(ctx, tx, opID, in.OperationType, line, effectiveAt)
		if err != nil {
			return nil, err
		}
		movementIDs = append(movementIDs, mid)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO sync_events (entity_type, entity_id, action, payload)
		VALUES ('operation', $1, 'created', '{}')
	`, opID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &ApplyResult{OperationID: opID, MovementIDs: movementIDs, Applied: true}, nil
}

func (s *MovementService) applyLine(ctx context.Context, tx pgx.Tx, opID uuid.UUID, opType domain.OperationType, line domain.MovementLine, at time.Time) (uuid.UUID, error) {
	var movementID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO stock_movements (operation_id, sku_id, lot_id, quantity, from_location_id, to_location_id, occurred_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, opID, line.SKUID, line.LotID, line.Quantity, line.FromLocationID, line.ToLocationID, at).Scan(&movementID)
	if err != nil {
		return uuid.Nil, err
	}

	switch opType {
	case domain.OpReceipt:
		if err := s.addBalance(ctx, tx, line.SKUID, *line.ToLocationID, line.LotID, line.Quantity); err != nil {
			return uuid.Nil, err
		}
	case domain.OpIssue:
		if err := s.subBalance(ctx, tx, line.SKUID, *line.FromLocationID, line.LotID, line.Quantity); err != nil {
			return uuid.Nil, err
		}
	case domain.OpTransfer:
		if err := s.subBalance(ctx, tx, line.SKUID, *line.FromLocationID, line.LotID, line.Quantity); err != nil {
			return uuid.Nil, err
		}
		if err := s.addBalance(ctx, tx, line.SKUID, *line.ToLocationID, line.LotID, line.Quantity); err != nil {
			return uuid.Nil, err
		}
	case domain.OpAdjustment:
		if line.ToLocationID != nil {
			if err := s.addBalance(ctx, tx, line.SKUID, *line.ToLocationID, line.LotID, line.Quantity); err != nil {
				return uuid.Nil, err
			}
		} else {
			if err := s.subBalance(ctx, tx, line.SKUID, *line.FromLocationID, line.LotID, line.Quantity); err != nil {
				return uuid.Nil, err
			}
		}
	}
	return movementID, nil
}

func (s *MovementService) addBalance(ctx context.Context, tx pgx.Tx, skuID, locationID uuid.UUID, lotID *uuid.UUID, qty int) error {
	warehouseID, err := s.warehouseForLocation(ctx, tx, locationID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO stock_balances (sku_id, warehouse_id, location_id, lot_id, quantity)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (sku_id, location_id, lot_id) DO UPDATE
		SET quantity = stock_balances.quantity + EXCLUDED.quantity, updated_at = now()
	`, skuID, warehouseID, locationID, lotID, qty)
	return err
}

func (s *MovementService) subBalance(ctx context.Context, tx pgx.Tx, skuID, locationID uuid.UUID, lotID *uuid.UUID, qty int) error {
	var current int
	err := tx.QueryRow(ctx, `
		SELECT quantity FROM stock_balances
		WHERE sku_id = $1 AND location_id = $2 AND lot_id IS NOT DISTINCT FROM $3
		FOR UPDATE
	`, skuID, locationID, lotID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.InsufficientStock("no stock at location")
	}
	if err != nil {
		return err
	}
	if current < qty {
		return apperr.InsufficientStock(fmt.Sprintf("need %d, have %d", qty, current))
	}
	_, err = tx.Exec(ctx, `
		UPDATE stock_balances SET quantity = quantity - $4, updated_at = now()
		WHERE sku_id = $1 AND location_id = $2 AND lot_id IS NOT DISTINCT FROM $3
	`, skuID, locationID, lotID, qty)
	return err
}

func (s *MovementService) warehouseForLocation(ctx context.Context, tx pgx.Tx, locationID uuid.UUID) (uuid.UUID, error) {
	var wh uuid.UUID
	err := tx.QueryRow(ctx, `SELECT warehouse_id FROM locations WHERE id = $1`, locationID).Scan(&wh)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, apperr.NotFound("location not found")
	}
	return wh, err
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
