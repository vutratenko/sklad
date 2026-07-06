package auth

import (
	"net/http"

	"github.com/vutratenko/sklad/internal/platform/config"
	"github.com/vutratenko/sklad/internal/platform/httpx"
)

type OIDCConfigResponse struct {
	DevBypass             bool   `json:"dev_bypass"`
	Issuer                string `json:"issuer,omitempty"`
	ClientID              string `json:"client_id,omitempty"`
	AuthorizationEndpoint string `json:"authorization_endpoint,omitempty"`
	TokenEndpoint         string `json:"token_endpoint,omitempty"`
	RedirectURI           string `json:"redirect_uri,omitempty"`
	Scope                 string `json:"scope,omitempty"`
}

func OIDCConfigHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := OIDCConfigResponse{
			DevBypass: cfg.DevBypassEnabled(),
			Scope:     "openid profile email",
		}
		if !cfg.DevBypassEnabled() {
			resp.Issuer = cfg.OIDCIssuer
			resp.ClientID = cfg.OIDCClientID
			resp.AuthorizationEndpoint = DefaultAuthorizeURL(cfg.OIDCIssuer)
			resp.TokenEndpoint = DefaultTokenURL(cfg.OIDCIssuer)
			resp.RedirectURI = cfg.OIDCRedirectURI
			if resp.RedirectURI == "" {
				resp.RedirectURI = "http://localhost:3000/oauth/callback"
			}
		}
		httpx.WriteJSON(w, http.StatusOK, resp)
	}
}

func NewValidator(cfg *config.Config) TokenValidator {
	if cfg.DevBypassEnabled() {
		return nil
	}
	jwksURL := cfg.OIDCJWKSURL
	if jwksURL == "" {
		jwksURL = DefaultJWKSURL(cfg.OIDCIssuer)
	}
	jwtValidator := NewJWKSValidator(jwksURL, ValidatorOptions{
		Issuer:   cfg.OIDCIssuer,
		Audience: cfg.OIDCClientID,
	})
	return NewFallbackValidator(jwtValidator, NewNextcloudUserValidator(cfg.OIDCIssuer))
}
