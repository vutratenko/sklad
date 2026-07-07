package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/vutratenko/sklad/internal/platform/config"
)

func TestStaticValidator_ValidToken(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	validator := NewStaticValidator(&key.PublicKey, ValidatorOptions{
		Issuer:   "https://nextcloud.test",
		Audience: "sklad-client",
	})

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":   "user-42",
		"email": "user@test.local",
		"name":  "Test User",
		"iss":   "https://nextcloud.test",
		"aud":   "sklad-client",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}

	user, err := validator.Validate(context.Background(), signed)
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if user.ID != "user-42" {
		t.Fatalf("expected user-42, got %s", user.ID)
	}
	if user.Email != "user@test.local" {
		t.Fatalf("unexpected email %s", user.Email)
	}
}

func TestStaticValidator_InvalidIssuer(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	validator := NewStaticValidator(&key.PublicKey, ValidatorOptions{
		Issuer:   "https://nextcloud.test",
		Audience: "sklad-client",
	})

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "user-42",
		"iss": "https://evil.test",
		"aud": "sklad-client",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	signed, _ := token.SignedString(key)
	if _, err := validator.Validate(context.Background(), signed); err == nil {
		t.Fatal("expected validation error for wrong issuer")
	}
}

func TestMiddleware_DevBypassOnlyInDevelopment(t *testing.T) {
	mw := NewMiddleware(MiddlewareConfig{
		DevBypassEnabled: true,
	}, nil)
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := UserFromContext(r.Context())
		if !ok || u.ID != "dev-user" {
			t.Fatalf("unexpected user: %+v", u)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/skus", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestMiddleware_OIDCRequiresBearerToken(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	validator := NewStaticValidator(&key.PublicKey, ValidatorOptions{
		Issuer:   "https://nextcloud.test",
		Audience: "sklad-client",
	})
	mw := NewMiddleware(MiddlewareConfig{DevBypassEnabled: false}, validator)
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/skus", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["error_code"] != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %q", body["error_code"])
	}
}

func TestMiddleware_OIDCValidToken(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	validator := NewStaticValidator(&key.PublicKey, ValidatorOptions{
		Issuer:   "https://nextcloud.test",
		Audience: "sklad-client",
	})
	mw := NewMiddleware(MiddlewareConfig{DevBypassEnabled: false}, validator)

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":   "nc-user",
		"email": "nc@test",
		"name":  "NC User",
		"iss":   "https://nextcloud.test",
		"aud":   "sklad-client",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})
	signed, _ := token.SignedString(key)

	var gotID string
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, _ := UserFromContext(r.Context())
		gotID = u.ID
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/skus", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if gotID != "nc-user" {
		t.Fatalf("expected nc-user, got %s", gotID)
	}
}

func TestMiddleware_PublicOIDCConfig(t *testing.T) {
	mw := NewMiddleware(MiddlewareConfig{DevBypassEnabled: false}, nil)
	called := false
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oidc/config", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if !called || rec.Code != http.StatusOK {
		t.Fatalf("expected public oidc config, called=%v code=%d", called, rec.Code)
	}
}

func TestOIDCConfigHandler_ReturnsLocalTokenEndpoint(t *testing.T) {
	cfg := &config.Config{
		AppEnv:       "production",
		OIDCIssuer:   "https://cloud.test",
		OIDCClientID: "sklad-client",
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oidc/config", nil)
	rec := httptest.NewRecorder()

	OIDCConfigHandler(cfg).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var body OIDCConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.TokenEndpoint != LocalTokenEndpoint {
		t.Fatalf("expected local token endpoint, got %q", body.TokenEndpoint)
	}
}

func TestOIDCTokenHandler_ExchangesCodeThroughProvider(t *testing.T) {
	var got url.Values
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/apps/oauth2/api/v1/token" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method %s", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		got = r.Form
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"opaque-access","token_type":"Bearer"}`))
	}))
	defer provider.Close()

	cfg := &config.Config{
		AppEnv:           "production",
		OIDCIssuer:       provider.URL,
		OIDCClientID:     "sklad-client",
		OIDCClientSecret: "client-secret",
	}
	form := url.Values{
		"code":          {"auth-code"},
		"redirect_uri":  {"https://sklad.test/oauth/callback"},
		"code_verifier": {"pkce-verifier"},
	}
	req := httptest.NewRequest(http.MethodPost, LocalTokenEndpoint, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	OIDCTokenHandler(cfg).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if got.Get("client_secret") != "client-secret" {
		t.Fatalf("expected client_secret forwarded to provider")
	}
	if got.Get("client_id") != "sklad-client" || got.Get("code") != "auth-code" || got.Get("code_verifier") != "pkce-verifier" {
		t.Fatalf("unexpected provider form: %v", got)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["access_token"] != "opaque-access" {
		t.Fatalf("unexpected token response: %v", body)
	}
}
