package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/vutratenko/sklad/internal/platform/httpx"
)

type MiddlewareConfig struct {
	DevBypassEnabled bool
}

type Middleware struct {
	cfg       MiddlewareConfig
	validator TokenValidator
}

func NewMiddleware(cfg MiddlewareConfig, validator TokenValidator) *Middleware {
	return &Middleware{cfg: cfg, validator: validator}
}

func (m *Middleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		if m.cfg.DevBypassEnabled {
			ctx := context.WithValue(r.Context(), UserContextKey, DevUser())
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		raw := bearerToken(r.Header.Get("Authorization"))
		if raw == "" {
			writeUnauthorized(w, r, "missing token")
			return
		}
		if m.validator == nil {
			writeUnauthorized(w, r, "auth validator not configured")
			return
		}

		user, err := m.validator.Validate(r.Context(), raw)
		if err != nil {
			writeUnauthorized(w, r, "invalid token")
			return
		}
		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isPublicPath(path string) bool {
	switch path {
	case "/health", "/api/v1/health", "/api/v1/auth/oidc/config", "/api/v1/auth/oidc/token":
		return true
	default:
		return strings.HasPrefix(path, "/api/v1/media/")
	}
}

func bearerToken(header string) string {
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}

func writeUnauthorized(w http.ResponseWriter, r *http.Request, message string) {
	reqID := r.Header.Get("X-Request-ID")
	if reqID == "" {
		reqID = "unknown"
	}
	httpx.WriteJSON(w, http.StatusUnauthorized, httpx.ErrorResponse{
		ErrorCode: "UNAUTHORIZED",
		Message:   message,
		RequestID: reqID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}
