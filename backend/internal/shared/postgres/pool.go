package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Pool interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type TxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

type PoolAdapter struct {
	*pgxpool.Pool
}

func (p *PoolAdapter) Begin(ctx context.Context) (pgx.Tx, error) {
	return p.Pool.Begin(ctx)
}
