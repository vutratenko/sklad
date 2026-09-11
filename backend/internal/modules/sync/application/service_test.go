package application_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	catalogdomain "github.com/vutratenko/sklad/internal/modules/catalog/domain"
	syncapp "github.com/vutratenko/sklad/internal/modules/sync/application"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type fakeCatalog struct {
	skus map[uuid.UUID]*catalogdomain.SKU
}

func (f *fakeCatalog) Create(_ context.Context, in catalogdomain.CreateSKUInput) (*catalogdomain.SKU, error) {
	id := uuid.New()
	if in.ID != nil {
		id = *in.ID
		if existing, ok := f.skus[id]; ok {
			return existing, nil
		}
	}
	sku := &catalogdomain.SKU{
		ID:          id,
		Name:        in.Name,
		Description: in.Description,
		Category:    in.Category,
		Unit:        in.Unit,
		IsActive:    true,
		Barcodes:    in.Barcodes,
	}
	f.skus[id] = sku
	return sku, nil
}

func (f *fakeCatalog) Get(_ context.Context, id string) (*catalogdomain.SKU, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	sku, ok := f.skus[uid]
	if !ok {
		return nil, apperr.NotFound("sku not found")
	}
	return sku, nil
}

func (f *fakeCatalog) Update(_ context.Context, id string, in catalogdomain.UpdateSKUInput) (*catalogdomain.SKU, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	sku, ok := f.skus[uid]
	if !ok {
		return nil, apperr.NotFound("sku not found")
	}
	if in.Name != nil {
		sku.Name = *in.Name
	}
	if in.Category != nil {
		sku.Category = *in.Category
	}
	if in.Unit != nil {
		sku.Unit = *in.Unit
	}
	if in.Description != nil {
		sku.Description = *in.Description
	}
	return sku, nil
}

type fakeEvents struct{}

func (fakeEvents) LatestCursor(_ context.Context) (int64, error) { return 0, nil }
func (fakeEvents) ListEvents(_ context.Context, _ int64, _ int) ([]syncapp.SyncEvent, error) {
	return nil, nil
}

func TestSyncPush_SKUCreateApplied(t *testing.T) {
	clientID := uuid.MustParse("33333333-3333-4333-8333-333333333333")
	catalog := &fakeCatalog{skus: map[uuid.UUID]*catalogdomain.SKU{}}
	svc := syncapp.NewSyncService(nil, fakeEvents{}, catalog)

	payload, _ := json.Marshal(map[string]any{
		"id": clientID.String(), "name": "Tomato", "category": "консервы", "unit": "шт",
	})
	resp, err := svc.Push(context.Background(), syncapp.SyncPushRequest{
		DeviceID: "dev-1", BatchID: "b1", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-sku-1", IdempotencyKey: "op-sku-1",
			Entity: "sku", Action: "create", Payload: payload,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Results[0].Status != "applied" {
		t.Fatalf("expected applied, got %+v", resp.Results[0])
	}
	if resp.Results[0].ServerID != clientID.String() {
		t.Fatalf("expected server_id %s, got %s", clientID, resp.Results[0].ServerID)
	}
}

func TestSyncPush_SKUCreateDuplicateReplayed(t *testing.T) {
	clientID := uuid.MustParse("44444444-4444-4444-8444-444444444444")
	catalog := &fakeCatalog{skus: map[uuid.UUID]*catalogdomain.SKU{}}
	svc := syncapp.NewSyncService(nil, fakeEvents{}, catalog)

	payload, _ := json.Marshal(map[string]any{
		"id": clientID.String(), "name": "Jam", "unit": "шт",
	})
	req := syncapp.SyncPushRequest{
		DeviceID: "dev-1", BatchID: "b1", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-sku-1", IdempotencyKey: "op-sku-1",
			Entity: "sku", Action: "create", Payload: payload,
		}},
	}
	if _, err := svc.Push(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	dup, err := svc.Push(context.Background(), syncapp.SyncPushRequest{
		DeviceID: "dev-1", BatchID: "b2", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-sku-2", IdempotencyKey: "op-sku-2",
			Entity: "sku", Action: "create", Payload: payload,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if dup.Results[0].Status != "duplicate_replayed" {
		t.Fatalf("expected duplicate_replayed, got %+v", dup.Results[0])
	}
}

func TestSyncPush_SKUUpdateApplied(t *testing.T) {
	clientID := uuid.MustParse("55555555-5555-4555-8555-555555555555")
	catalog := &fakeCatalog{skus: map[uuid.UUID]*catalogdomain.SKU{
		clientID: {ID: clientID, Name: "Old", Unit: "шт", IsActive: true},
	}}
	svc := syncapp.NewSyncService(nil, fakeEvents{}, catalog)

	payload, _ := json.Marshal(map[string]any{
		"id": clientID.String(), "name": "New name", "category": "бакалея",
	})
	resp, err := svc.Push(context.Background(), syncapp.SyncPushRequest{
		DeviceID: "dev-1", BatchID: "b1", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-upd", IdempotencyKey: "op-upd",
			Entity: "sku", Action: "update", Payload: payload,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Results[0].Status != "applied" {
		t.Fatalf("expected applied, got %+v", resp.Results[0])
	}
	if catalog.skus[clientID].Name != "New name" {
		t.Fatalf("expected updated name, got %q", catalog.skus[clientID].Name)
	}
}

func TestSyncPush_SKUDeleteUnsupported(t *testing.T) {
	svc := syncapp.NewSyncService(nil, fakeEvents{}, &fakeCatalog{skus: map[uuid.UUID]*catalogdomain.SKU{}})
	payload, _ := json.Marshal(map[string]any{"id": uuid.New().String()})
	resp, err := svc.Push(context.Background(), syncapp.SyncPushRequest{
		DeviceID: "dev-1", BatchID: "b1", SchemaVersion: 1,
		Operations: []syncapp.SyncOperation{{
			OperationID: "op-del", IdempotencyKey: "op-del",
			Entity: "sku", Action: "delete", Payload: payload,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Results[0].Status != "rejected" || resp.Results[0].ErrorCode != "UNSUPPORTED_OPERATION" {
		t.Fatalf("expected unsupported, got %+v", resp.Results[0])
	}
}
