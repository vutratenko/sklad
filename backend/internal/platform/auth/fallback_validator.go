package auth

import (
	"context"
	"fmt"
)

type FallbackValidator struct {
	validators []TokenValidator
}

func NewFallbackValidator(validators ...TokenValidator) *FallbackValidator {
	return &FallbackValidator{validators: validators}
}

func (v *FallbackValidator) Validate(ctx context.Context, rawToken string) (User, error) {
	var lastErr error
	for _, validator := range v.validators {
		if validator == nil {
			continue
		}
		user, err := validator.Validate(ctx, rawToken)
		if err == nil {
			return user, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return User{}, lastErr
	}
	return User{}, fmt.Errorf("no auth validators configured")
}
