package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	AppEnv           string
	HTTPAddr         string
	DatabaseURL      string
	AuthDevBypass    bool
	OIDCIssuer       string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCJWKSURL      string
	OIDCUserInfoURL  string
	OIDCUserInfoHost string
	OIDCRedirectURI  string
	IdempotencyTTL   int // days
	MediaDir         string
}

func (c *Config) DevBypassEnabled() bool {
	return c.AppEnv == "development" && c.AuthDevBypass
}

func Load() (*Config, error) {
	viper.SetDefault("APP_ENV", "development")
	viper.SetDefault("HTTP_ADDR", ":8080")
	viper.SetDefault("AUTH_DEV_BYPASS", false)
	viper.SetDefault("IDEMPOTENCY_TTL_DAYS", 30)
	viper.SetDefault("MEDIA_DIR", "./data/media")

	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	cfg := &Config{
		AppEnv:           viper.GetString("APP_ENV"),
		HTTPAddr:         viper.GetString("HTTP_ADDR"),
		DatabaseURL:      viper.GetString("DATABASE_URL"),
		AuthDevBypass:    viper.GetBool("AUTH_DEV_BYPASS"),
		OIDCIssuer:       viper.GetString("OIDC_ISSUER"),
		OIDCClientID:     viper.GetString("OIDC_CLIENT_ID"),
		OIDCClientSecret: viper.GetString("OIDC_CLIENT_SECRET"),
		OIDCJWKSURL:      viper.GetString("OIDC_JWKS_URL"),
		OIDCUserInfoURL:  viper.GetString("OIDC_USERINFO_URL"),
		OIDCUserInfoHost: viper.GetString("OIDC_USERINFO_HOST"),
		OIDCRedirectURI:  viper.GetString("OIDC_REDIRECT_URI"),
		IdempotencyTTL:   viper.GetInt("IDEMPOTENCY_TTL_DAYS"),
		MediaDir:         viper.GetString("MEDIA_DIR"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.AppEnv == "production" && c.AuthDevBypass {
		return fmt.Errorf("AUTH_DEV_BYPASS cannot be enabled in production")
	}
	if !c.DevBypassEnabled() {
		if c.OIDCIssuer == "" || c.OIDCClientID == "" {
			return fmt.Errorf("OIDC_ISSUER and OIDC_CLIENT_ID are required when dev bypass is disabled")
		}
	}
	return nil
}
