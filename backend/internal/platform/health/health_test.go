package health_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/vutratenko/sklad/internal/platform/health"
)

type stubDB struct {
	err error
}

func (s stubDB) Ping(_ context.Context) error {
	return s.err
}

func TestHandler_OK(t *testing.T) {
	h := health.NewHandler(stubDB{})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}
	if body["database"] != "ok" {
		t.Fatalf("expected database ok, got %q", body["database"])
	}
}

func TestHandler_DatabaseDown(t *testing.T) {
	h := health.NewHandler(stubDB{err: errors.New("connection refused")})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}
}
