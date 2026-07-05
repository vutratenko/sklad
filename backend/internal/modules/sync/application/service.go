package application

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	moveapp "github.com/vutratenko/sklad/internal/modules/movements/application"
	movedomain "github.com/vutratenko/sklad/internal/modules/movements/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type SyncOperation struct {
	OperationID    string          `json:"operation_id"`
	IdempotencyKey string          `json:"idempotency_key"`
	Entity         string          `json:"entity"`
	Action         string          `json:"action"`
	Payload        json.RawMessage `json:"payload"`
	ClientTS       string          `json:"client_ts"`
}

type SyncPushRequest struct {
	DeviceID      string          `json:"device_id"`
	BatchID       string          `json:"batch_id"`
	SchemaVersion int             `json:"schema_version"`
	Operations    []SyncOperation `json:"operations"`
}

type SyncOpResult struct {
	OperationID string `json:"operation_id"`
	Status      string `json:"status"`
	ErrorCode   string `json:"error_code,omitempty"`
	Message     string `json:"message,omitempty"`
	ServerID    string `json:"server_id,omitempty"`
}

type SyncPushResponse struct {
	BatchID       string         `json:"batch_id"`
	AcceptedCount int            `json:"accepted_count"`
	RejectedCount int            `json:"rejected_count"`
	Results       []SyncOpResult `json:"results"`
	ServerCursor  int64          `json:"server_cursor"`
}

type SyncEvent struct {
	Seq        int64           `json:"seq"`
	EntityType string          `json:"entity_type"`
	EntityID   string          `json:"entity_id"`
	Action     string          `json:"action"`
	Payload    json.RawMessage `json:"payload"`
	CreatedAt  string          `json:"created_at"`
}

type SyncPullResponse struct {
	FromCursor int64       `json:"from_cursor"`
	ToCursor   int64       `json:"to_cursor"`
	Events     []SyncEvent `json:"events"`
	HasMore    bool        `json:"has_more"`
}

type EventStore interface {
	LatestCursor(ctx context.Context) (int64, error)
	ListEvents(ctx context.Context, after int64, limit int) ([]SyncEvent, error)
}

type SyncService struct {
	movements *moveapp.MovementService
	events    EventStore
}

func NewSyncService(movements *moveapp.MovementService, events EventStore) *SyncService {
	return &SyncService{movements: movements, events: events}
}

type movementPayload struct {
	OperationType string `json:"operation_type"`
	ReasonCode    string `json:"reason_code"`
	Lines         []struct {
		SKUID          string  `json:"sku_id"`
		LotID          *string `json:"lot_id"`
		Quantity       int     `json:"quantity"`
		FromLocationID *string `json:"from_location_id"`
		ToLocationID   *string `json:"to_location_id"`
	} `json:"lines"`
}

func (s *SyncService) Push(ctx context.Context, req SyncPushRequest) (*SyncPushResponse, error) {
	if req.DeviceID == "" {
		return nil, apperr.Validation("device_id required")
	}
	resp := &SyncPushResponse{BatchID: req.BatchID, Results: make([]SyncOpResult, 0, len(req.Operations))}
	for _, op := range req.Operations {
		result := SyncOpResult{OperationID: op.OperationID}
		if op.Entity == "movement" && op.Action == "create" {
			res, err := s.applyMovementOp(ctx, req.DeviceID, op)
			if err != nil {
				result.Status = "rejected"
				if ae, ok := err.(*apperr.AppError); ok {
					result.ErrorCode = ae.Code
					result.Message = ae.Message
				} else {
					result.ErrorCode = "INTERNAL_ERROR"
					result.Message = err.Error()
				}
				resp.RejectedCount++
			} else {
				if res.Applied {
					result.Status = "applied"
				} else {
					result.Status = "duplicate_replayed"
				}
				result.ServerID = res.OperationID.String()
				resp.AcceptedCount++
			}
		} else {
			result.Status = "rejected"
			result.ErrorCode = "UNSUPPORTED_OPERATION"
			result.Message = "unsupported entity/action"
			resp.RejectedCount++
		}
		resp.Results = append(resp.Results, result)
	}
	cursor, _ := s.events.LatestCursor(ctx)
	resp.ServerCursor = cursor
	return resp, nil
}

func (s *SyncService) Pull(ctx context.Context, cursor int64, limit int) (*SyncPullResponse, error) {
	if limit <= 0 {
		limit = 100
	}
	events, err := s.events.ListEvents(ctx, cursor, limit+1)
	if err != nil {
		return nil, err
	}
	hasMore := len(events) > limit
	if hasMore {
		events = events[:limit]
	}
	toCursor := cursor
	if len(events) > 0 {
		toCursor = events[len(events)-1].Seq
	}
	return &SyncPullResponse{
		FromCursor: cursor,
		ToCursor:   toCursor,
		Events:     events,
		HasMore:    hasMore,
	}, nil
}

func (s *SyncService) applyMovementOp(ctx context.Context, deviceID string, op SyncOperation) (*moveapp.ApplyResult, error) {
	var payload movementPayload
	if err := json.Unmarshal(op.Payload, &payload); err != nil {
		return nil, apperr.Validation("invalid movement payload")
	}
	key := op.IdempotencyKey
	if key == "" {
		key = op.OperationID
	}
	hash := moveapp.HashPayload(op.Payload)
	lines := make([]movedomain.MovementLine, 0, len(payload.Lines))
	for _, l := range payload.Lines {
		skuID, err := uuid.Parse(l.SKUID)
		if err != nil {
			return nil, apperr.Validation("invalid sku_id")
		}
		line := movedomain.MovementLine{SKUID: skuID, Quantity: l.Quantity}
		if l.LotID != nil {
			id, err := uuid.Parse(*l.LotID)
			if err != nil {
				return nil, apperr.Validation("invalid lot_id")
			}
			line.LotID = &id
		}
		if l.FromLocationID != nil {
			id, err := uuid.Parse(*l.FromLocationID)
			if err != nil {
				return nil, apperr.Validation("invalid from_location_id")
			}
			line.FromLocationID = &id
		}
		if l.ToLocationID != nil {
			id, err := uuid.Parse(*l.ToLocationID)
			if err != nil {
				return nil, apperr.Validation("invalid to_location_id")
			}
			line.ToLocationID = &id
		}
		lines = append(lines, line)
	}
	return s.movements.Apply(ctx, movedomain.ApplyMovementInput{
		OperationType: movedomain.OperationType(payload.OperationType),
		ReasonCode:    payload.ReasonCode,
		Lines:         lines,
		DeviceID:      deviceID,
		OperationKey:  key,
		PayloadHash:   hash,
		CreatedBy:     "sync",
	})
}
