package auth_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/vutratenko/sklad/internal/platform/auth"
)

type stubValidator struct {
	user auth.User
}

func (v stubValidator) Validate(_ context.Context, _ string) (auth.User, error) {
	return v.user, nil
}

func TestMiddleware_HealthBypassWithoutToken(t *testing.T) {
	mw := auth.NewMiddleware(auth.MiddlewareConfig{DevBypassEnabled: false}, nil)
	called := false
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	for _, path := range []string{"/health", "/api/v1/health", "/api/v1/auth/oidc/config", "/api/v1/auth/oidc/token", "/api/v1/auth/logout"} {
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

func TestMiddleware_AcceptsAppSessionWithoutProviderValidator(t *testing.T) {
	session := auth.NewSessionManager("secret", 24*time.Hour, false)
	rec := httptest.NewRecorder()
	if _, err := session.SetCookie(rec, auth.User{ID: "user-42"}); err != nil {
		t.Fatal(err)
	}

	mw := auth.NewMiddleware(auth.MiddlewareConfig{
		DevBypassEnabled: false,
		SessionManager:   session,
	}, nil)
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user.ID != "user-42" {
			t.Fatalf("unexpected user %+v", user)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	for _, cookie := range rec.Result().Cookies() {
		req.AddCookie(cookie)
	}
	out := httptest.NewRecorder()
	handler.ServeHTTP(out, req)

	if out.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", out.Code, out.Body.String())
	}
}

func TestMiddleware_IssuesAppSessionAfterBearerFallback(t *testing.T) {
	session := auth.NewSessionManager("secret", 24*time.Hour, false)
	mw := auth.NewMiddleware(auth.MiddlewareConfig{
		DevBypassEnabled: false,
		SessionManager:   session,
	}, stubValidator{user: auth.User{ID: "user-42"}})
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer legacy-provider-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != auth.SessionCookieName {
		t.Fatalf("expected app session cookie, got %#v", cookies)
	}
}
