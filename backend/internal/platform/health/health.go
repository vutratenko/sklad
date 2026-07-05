package health

import (
	"context"
	"net/http"

	"github.com/vutratenko/sklad/internal/platform/httpx"
)

type Pinger interface {
	Ping(ctx context.Context) error
}

type Handler struct {
	db Pinger
}

func NewHandler(db Pinger) *Handler {
	return &Handler{db: db}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	status := "ok"
	code := http.StatusOK
	dbStatus := "ok"

	if h.db != nil {
		if err := h.db.Ping(r.Context()); err != nil {
			dbStatus = "down"
			status = "degraded"
			code = http.StatusServiceUnavailable
		}
	}

	httpx.WriteJSON(w, code, map[string]string{
		"status":   status,
		"database": dbStatus,
	})
}
