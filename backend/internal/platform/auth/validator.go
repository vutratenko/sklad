package auth

import (
	"context"
	"crypto/rsa"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type TokenValidator interface {
	Validate(ctx context.Context, rawToken string) (User, error)
}

type ValidatorOptions struct {
	Issuer   string
	Audience string
}

type StaticValidator struct {
	publicKey *rsa.PublicKey
	opts      ValidatorOptions
}

func NewStaticValidator(publicKey *rsa.PublicKey, opts ValidatorOptions) *StaticValidator {
	return &StaticValidator{publicKey: publicKey, opts: opts}
}

func (v *StaticValidator) Validate(_ context.Context, rawToken string) (User, error) {
	token, err := jwt.Parse(rawToken, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodRS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return v.publicKey, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
	if err != nil {
		return User{}, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return User{}, fmt.Errorf("invalid claims")
	}
	if err := v.validateStandardClaims(claims); err != nil {
		return User{}, err
	}
	return userFromClaims(claims), nil
}

func (v *StaticValidator) validateStandardClaims(claims jwt.MapClaims) error {
	if iss, _ := claims["iss"].(string); iss != v.opts.Issuer {
		return fmt.Errorf("invalid issuer")
	}
	if !audienceMatches(claims, v.opts.Audience) {
		return fmt.Errorf("invalid audience")
	}
	if exp, err := claims.GetExpirationTime(); err != nil || exp == nil || exp.Before(time.Now()) {
		return fmt.Errorf("token expired")
	}
	return nil
}

func audienceMatches(claims jwt.MapClaims, expected string) bool {
	if expected == "" {
		return true
	}
	switch aud := claims["aud"].(type) {
	case string:
		return aud == expected
	case []any:
		for _, item := range aud {
			if s, ok := item.(string); ok && s == expected {
				return true
			}
		}
	}
	return false
}

func userFromClaims(claims jwt.MapClaims) User {
	user := User{}
	if sub, ok := claims["sub"].(string); ok {
		user.ID = sub
	}
	if email, ok := claims["email"].(string); ok {
		user.Email = email
	} else if preferred, ok := claims["preferred_username"].(string); ok {
		user.Email = preferred
	}
	if name, ok := claims["name"].(string); ok {
		user.Name = name
	} else if user.Email != "" {
		user.Name = strings.Split(user.Email, "@")[0]
	}
	return user
}

func DevUser() User {
	return User{ID: "dev-user", Name: "Developer", Email: "dev@local"}
}
