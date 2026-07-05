package apperr

import "fmt"

type AppError struct {
	Code       string
	Message    string
	HTTPStatus int
	Details    map[string]any
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func Validation(msg string) *AppError {
	return &AppError{Code: "VALIDATION_ERROR", Message: msg, HTTPStatus: 422}
}

func NotFound(msg string) *AppError {
	return &AppError{Code: "NOT_FOUND", Message: msg, HTTPStatus: 404}
}

func Conflict(code, msg string) *AppError {
	return &AppError{Code: code, Message: msg, HTTPStatus: 409}
}

func InsufficientStock(msg string) *AppError {
	return Conflict("INSUFFICIENT_STOCK", msg)
}

func IdempotencyMismatch() *AppError {
	return Conflict("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH", "operation key reused with different payload")
}

func DuplicateBarcode() *AppError {
	return Conflict("DUPLICATE_BARCODE", "barcode already assigned to another SKU")
}
