package config_test

import (
	"testing"

	"github.com/vutratenko/sklad/internal/platform/config"
)

func TestLoad_RequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error when DATABASE_URL is empty")
	}
}

func TestLoad_ProductionRejectsDevBypass(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/sklad?sslmode=disable")
	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_DEV_BYPASS", "true")
	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error for AUTH_DEV_BYPASS in production")
	}
}

func TestLoad_DevelopmentDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/sklad?sslmode=disable")
	t.Setenv("APP_ENV", "development")
	t.Setenv("AUTH_DEV_BYPASS", "true")
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Fatalf("expected default HTTP_ADDR :8080, got %s", cfg.HTTPAddr)
	}
	if !cfg.DevBypassEnabled() {
		t.Fatal("expected dev bypass in development test defaults")
	}
}

func TestConfig_DevBypassEnabled_RequiresBothFlags(t *testing.T) {
	cfg := &config.Config{AppEnv: "development", AuthDevBypass: true}
	if !cfg.DevBypassEnabled() {
		t.Fatal("expected dev bypass when development + AUTH_DEV_BYPASS")
	}

	cfg.AuthDevBypass = false
	if cfg.DevBypassEnabled() {
		t.Fatal("expected dev bypass disabled without AUTH_DEV_BYPASS")
	}

	cfg.AuthDevBypass = true
	cfg.AppEnv = "staging"
	if cfg.DevBypassEnabled() {
		t.Fatal("expected dev bypass disabled outside development")
	}
}

func TestLoad_OIDCRequiredWithoutDevBypass(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/sklad?sslmode=disable")
	t.Setenv("APP_ENV", "staging")
	t.Setenv("AUTH_DEV_BYPASS", "false")
	t.Setenv("OIDC_ISSUER", "")
	t.Setenv("OIDC_CLIENT_ID", "")
	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error when OIDC not configured without dev bypass")
	}
}

func TestLoad_SessionSecretRequiredWithoutDevBypass(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/sklad?sslmode=disable")
	t.Setenv("APP_ENV", "staging")
	t.Setenv("AUTH_DEV_BYPASS", "false")
	t.Setenv("OIDC_ISSUER", "https://cloud.test")
	t.Setenv("OIDC_CLIENT_ID", "sklad-client")
	t.Setenv("SESSION_SECRET", "")
	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error when SESSION_SECRET is empty")
	}
}

func TestLoad_AcceptsLegacyOIDCIssuerURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/sklad?sslmode=disable")
	t.Setenv("APP_ENV", "staging")
	t.Setenv("AUTH_DEV_BYPASS", "false")
	t.Setenv("OIDC_ISSUER", "")
	t.Setenv("OIDC_ISSUER_URL", "https://cloud.test")
	t.Setenv("OIDC_CLIENT_ID", "sklad-client")
	t.Setenv("SESSION_SECRET", "secret")
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.OIDCIssuer != "https://cloud.test" {
		t.Fatalf("unexpected issuer %q", cfg.OIDCIssuer)
	}
}

func TestLoad_DevBypassSkipsOIDCRequirement(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/sklad?sslmode=disable")
	t.Setenv("APP_ENV", "development")
	t.Setenv("AUTH_DEV_BYPASS", "true")
	t.Setenv("OIDC_ISSUER", "")
	t.Setenv("OIDC_CLIENT_ID", "")
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.DevBypassEnabled() {
		t.Fatal("expected dev bypass enabled")
	}
}
