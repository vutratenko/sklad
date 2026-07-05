package application_test

import (
	"encoding/json"
	"testing"

	moveapp "github.com/vutratenko/sklad/internal/modules/movements/application"
)

func TestHashPayload_Deterministic(t *testing.T) {
	payload := map[string]any{
		"operation_type": "receipt",
		"lines":          []map[string]any{{"sku_id": "abc", "quantity": 5}},
	}
	h1 := moveapp.HashPayload(payload)
	h2 := moveapp.HashPayload(payload)
	if h1 != h2 {
		t.Fatalf("expected same hash, got %s vs %s", h1, h2)
	}
}

func TestHashPayload_DifferentPayload(t *testing.T) {
	h1 := moveapp.HashPayload(json.RawMessage(`{"a":1}`))
	h2 := moveapp.HashPayload(json.RawMessage(`{"a":2}`))
	if h1 == h2 {
		t.Fatal("expected different hashes")
	}
}
