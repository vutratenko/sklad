package auth

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/vutratenko/sklad/internal/platform/config"
	"github.com/vutratenko/sklad/internal/platform/httpx"
)

const LocalTokenEndpoint = "/api/v1/auth/oidc/token"

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
			resp.TokenEndpoint = LocalTokenEndpoint
			resp.RedirectURI = cfg.OIDCRedirectURI
			if resp.RedirectURI == "" {
				resp.RedirectURI = "http://localhost:3000/oauth/callback"
			}
		}
		httpx.WriteJSON(w, http.StatusOK, resp)
	}
}

func OIDCTokenHandler(cfg *config.Config) http.HandlerFunc {
	client := &http.Client{Timeout: 10 * time.Second}
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.DevBypassEnabled() {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "oidc is disabled"})
			return
		}
		if err := r.ParseForm(); err != nil {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid token request"})
			return
		}

		code := strings.TrimSpace(r.Form.Get("code"))
		verifier := strings.TrimSpace(r.Form.Get("code_verifier"))
		redirectURI := strings.TrimSpace(r.Form.Get("redirect_uri"))
		if redirectURI == "" {
			redirectURI = cfg.OIDCRedirectURI
		}
		if code == "" || verifier == "" || redirectURI == "" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "missing token request fields"})
			return
		}

		form := url.Values{
			"grant_type":    {"authorization_code"},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"client_id":     {cfg.OIDCClientID},
			"code_verifier": {verifier},
		}
		if cfg.OIDCClientSecret != "" {
			form.Set("client_secret", cfg.OIDCClientSecret)
		}

		upstreamReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, DefaultTokenURL(cfg.OIDCIssuer), strings.NewReader(form.Encode()))
		if err != nil {
			httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "token request failed"})
			return
		}
		upstreamReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		upstreamReq.Header.Set("Accept", "application/json")

		upstreamResp, err := client.Do(upstreamReq)
		if err != nil {
			httpx.WriteJSON(w, http.StatusBadGateway, map[string]string{"error": "token provider unavailable"})
			return
		}
		defer upstreamResp.Body.Close()

		var body map[string]any
		if err := json.NewDecoder(upstreamResp.Body).Decode(&body); err != nil {
			httpx.WriteJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid token provider response"})
			return
		}
		if upstreamResp.StatusCode < http.StatusOK || upstreamResp.StatusCode >= http.StatusMultipleChoices {
			httpx.WriteJSON(w, http.StatusBadGateway, map[string]string{"error": "token exchange failed"})
			return
		}
		httpx.WriteJSON(w, http.StatusOK, body)
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
	userInfoURL := cfg.OIDCUserInfoURL
	if userInfoURL == "" {
		userInfoURL = DefaultNextcloudUserURL(cfg.OIDCIssuer)
	}
	return NewFallbackValidator(jwtValidator, NewNextcloudUserValidator(userInfoURL, cfg.OIDCUserInfoHost))
}
