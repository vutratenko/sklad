package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWKSValidator struct {
	jwksURL string
	opts    ValidatorOptions
	client  *http.Client
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
	ttl     time.Duration
}

type jwksKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksDocument struct {
	Keys []jwksKey `json:"keys"`
}

func NewJWKSValidator(jwksURL string, opts ValidatorOptions) *JWKSValidator {
	return &JWKSValidator{
		jwksURL: jwksURL,
		opts:    opts,
		client:  &http.Client{Timeout: 10 * time.Second},
		keys:    make(map[string]*rsa.PublicKey),
		ttl:     time.Hour,
	}
}

func (v *JWKSValidator) Validate(ctx context.Context, rawToken string) (User, error) {
	token, err := jwt.Parse(rawToken, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodRS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		kid, _ := t.Header["kid"].(string)
		return v.getKey(ctx, kid)
	}, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
	if err != nil {
		return User{}, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return User{}, fmt.Errorf("invalid claims")
	}
	sv := &StaticValidator{opts: v.opts}
	if err := sv.validateStandardClaims(claims); err != nil {
		return User{}, err
	}
	return userFromClaims(claims), nil
}

func (v *JWKSValidator) getKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	if time.Since(v.fetched) < v.ttl {
		if key, ok := v.keys[kid]; ok {
			v.mu.RUnlock()
			return key, nil
		}
		if len(v.keys) == 1 && kid == "" {
			for _, key := range v.keys {
				v.mu.RUnlock()
				return key, nil
			}
		}
	}
	v.mu.RUnlock()

	if err := v.refresh(ctx); err != nil {
		return nil, err
	}

	v.mu.RLock()
	defer v.mu.RUnlock()
	if key, ok := v.keys[kid]; ok {
		return key, nil
	}
	if len(v.keys) == 1 {
		for _, key := range v.keys {
			return key, nil
		}
	}
	return nil, fmt.Errorf("key %q not found", kid)
}

func (v *JWKSValidator) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch jwks: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch jwks: status %d", resp.StatusCode)
	}

	var doc jwksDocument
	if err := json.Unmarshal(body, &doc); err != nil {
		return fmt.Errorf("parse jwks: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey)
	for _, k := range doc.Keys {
		if k.Kty != "RSA" {
			continue
		}
		pub, err := parseRSAPublicKey(k.N, k.E)
		if err != nil {
			continue
		}
		keys[k.Kid] = pub
	}
	if len(keys) == 0 {
		return fmt.Errorf("no RSA keys in JWKS")
	}

	v.mu.Lock()
	v.keys = keys
	v.fetched = time.Now()
	v.mu.Unlock()
	return nil
}

func parseRSAPublicKey(nB64, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, err
	}
	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}
	return &rsa.PublicKey{N: n, E: e}, nil
}

func DefaultJWKSURL(issuer string) string {
	issuer = trimSlash(issuer)
	return issuer + "/apps/oauth2/api/v1/jwks"
}

func DefaultAuthorizeURL(issuer string) string {
	issuer = trimSlash(issuer)
	return issuer + "/apps/oauth2/authorize"
}

func DefaultTokenURL(issuer string) string {
	issuer = trimSlash(issuer)
	return issuer + "/apps/oauth2/api/v1/token"
}

func trimSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}
