package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionManager_RoundTrip(t *testing.T) {
	manager := NewSessionManager("secret", 365*24*time.Hour, true)
	manager.now = func() time.Time { return time.Unix(1000, 0) }
	rec := httptest.NewRecorder()

	expiresAt, err := manager.SetCookie(rec, User{ID: "user-42", Email: "user@example.com", Name: "Test User"})
	if err != nil {
		t.Fatal(err)
	}
	if expiresAt.Sub(manager.now()) != 365*24*time.Hour {
		t.Fatalf("unexpected expiry %s", expiresAt)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	for _, cookie := range rec.Result().Cookies() {
		req.AddCookie(cookie)
	}
	user, err := manager.UserFromRequest(req)
	if err != nil {
		t.Fatalf("UserFromRequest: %v", err)
	}
	if user.ID != "user-42" || user.Email != "user@example.com" {
		t.Fatalf("unexpected user %+v", user)
	}
}

func TestSessionManager_RejectsTamperedCookie(t *testing.T) {
	manager := NewSessionManager("secret", time.Hour, false)
	rec := httptest.NewRecorder()
	if _, err := manager.SetCookie(rec, User{ID: "user-42"}); err != nil {
		t.Fatal(err)
	}
	cookie := rec.Result().Cookies()[0]
	cookie.Value += "tampered"

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.AddCookie(cookie)
	if _, err := manager.UserFromRequest(req); err == nil {
		t.Fatal("expected tampered cookie to be rejected")
	}
}

func TestLogoutHandler_ClearsSessionCookie(t *testing.T) {
	manager := NewSessionManager("secret", time.Hour, true)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	rec := httptest.NewRecorder()

	LogoutHandler(manager).ServeHTTP(rec, req)

	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != SessionCookieName || cookies[0].MaxAge != -1 {
		t.Fatalf("expected clearing session cookie, got %#v", cookies)
	}
}
