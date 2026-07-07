package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/vutratenko/sklad/internal/platform/auth"
)

func TestMiddleware_HealthBypassWithoutToken(t *testing.T) {
	mw := auth.NewMiddleware(auth.MiddlewareConfig{DevBypassEnabled: false}, nil)
	called := false
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	for _, path := range []string{"/health", "/api/v1/health", "/api/v1/auth/oidc/config", "/api/v1/auth/oidc/token"} {
		called = false
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if !called {
			t.Fatalf("expected handler called for %s", path)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for %s, got %d", path, rec.Code)
		}
	}
}
