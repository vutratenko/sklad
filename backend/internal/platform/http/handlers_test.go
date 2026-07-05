package http_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	moveapp "github.com/vutratenko/sklad/internal/modules/movements/application"
	apihttp "github.com/vutratenko/sklad/internal/platform/http"
)

func TestCreateMovement_ValidationErrorEnvelope(t *testing.T) {
	h := &apihttp.Handlers{
		Movements: moveapp.NewMovementService(nil),
	}

	body := []byte(`{"operation_type":"receipt","device_id":"d1","operation_key":"k1","lines":[]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/movements", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Request-ID", "test-req-id")
	rec := httptest.NewRecorder()

	mux := http.NewServeMux()
	h.Register(mux)
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"error_code":"VALIDATION_ERROR"`)) {
		t.Fatalf("expected VALIDATION_ERROR envelope, got %s", rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"request_id":"test-req-id"`)) {
		t.Fatalf("expected request_id in envelope, got %s", rec.Body.String())
	}
}
