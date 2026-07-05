package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	syncapp "github.com/vutratenko/sklad/internal/modules/sync/application"
	"github.com/vutratenko/sklad/internal/shared/postgres"
)

type EventRepository struct {
	pool postgres.Pool
}

func NewEventRepository(pool postgres.Pool) *EventRepository {
	return &EventRepository{pool: pool}
}

func (r *EventRepository) LatestCursor(ctx context.Context) (int64, error) {
	var cursor int64
	err := r.pool.QueryRow(ctx, `SELECT COALESCE(MAX(id), 0) FROM sync_events`).Scan(&cursor)
	return cursor, err
}

func (r *EventRepository) ListEvents(ctx context.Context, after int64, limit int) ([]syncapp.SyncEvent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, entity_type, entity_id, action, payload, created_at
		FROM sync_events
		WHERE id > $1
		ORDER BY id ASC
		LIMIT $2
	`, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []syncapp.SyncEvent
	for rows.Next() {
		var e syncapp.SyncEvent
		var entityID uuid.UUID
		var payload []byte
		var createdAt time.Time
		if err := rows.Scan(&e.Seq, &e.EntityType, &entityID, &e.Action, &payload, &createdAt); err != nil {
			return nil, err
		}
		e.EntityID = entityID.String()
		e.Payload = json.RawMessage(payload)
		e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		events = append(events, e)
	}
	return events, rows.Err()
}
