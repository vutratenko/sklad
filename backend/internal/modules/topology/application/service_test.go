package application_test

import (
	"context"
	"testing"

	topologyapp "github.com/vutratenko/sklad/internal/modules/topology/application"
	topologydomain "github.com/vutratenko/sklad/internal/modules/topology/domain"
	"github.com/google/uuid"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type fakeRepo struct {
	warehouses map[uuid.UUID]*topologydomain.Warehouse
	locations  map[uuid.UUID]*topologydomain.Location
}

func (f *fakeRepo) CreateWarehouse(_ context.Context, in topologydomain.CreateWarehouseInput) (*topologydomain.Warehouse, error) {
	for _, existing := range f.warehouses {
		if existing.Code != in.Code {
			continue
		}
		if existing.IsActive {
			return nil, apperr.Conflict("DUPLICATE_WAREHOUSE_CODE", "warehouse code already exists")
		}
		existing.Name = in.Name
		existing.IsActive = true
		return existing, nil
	}
	w := &topologydomain.Warehouse{ID: uuid.New(), Code: in.Code, Name: in.Name, IsActive: true}
	f.warehouses[w.ID] = w
	return w, nil
}

func (f *fakeRepo) GetWarehouse(_ context.Context, id uuid.UUID) (*topologydomain.Warehouse, error) {
	w, ok := f.warehouses[id]
	if !ok {
		return nil, apperr.NotFound("warehouse not found")
	}
	return w, nil
}

func (f *fakeRepo) ListWarehouses(_ context.Context, activeOnly bool) ([]topologydomain.Warehouse, error) {
	var out []topologydomain.Warehouse
	for _, w := range f.warehouses {
		if activeOnly && !w.IsActive {
			continue
		}
		out = append(out, *w)
	}
	return out, nil
}

func (f *fakeRepo) UpdateWarehouse(_ context.Context, id uuid.UUID, in topologydomain.UpdateWarehouseInput) (*topologydomain.Warehouse, error) {
	w, err := f.GetWarehouse(context.Background(), id)
	if err != nil {
		return nil, err
	}
	if in.Code != nil {
		w.Code = *in.Code
	}
	if in.Name != nil {
		w.Name = *in.Name
	}
	if in.IsActive != nil {
		w.IsActive = *in.IsActive
	}
	return w, nil
}

func (f *fakeRepo) DeleteWarehouse(_ context.Context, id uuid.UUID) error {
	w, err := f.GetWarehouse(context.Background(), id)
	if err != nil {
		return err
	}
	w.IsActive = false
	return nil
}

func (f *fakeRepo) CreateLocation(_ context.Context, in topologydomain.CreateLocationInput) (*topologydomain.Location, error) {
	if _, ok := f.warehouses[in.WarehouseID]; !ok {
		return nil, apperr.NotFound("warehouse not found")
	}
	for _, existing := range f.locations {
		if existing.WarehouseID != in.WarehouseID || existing.Code != in.Code {
			continue
		}
		if existing.IsActive {
			return nil, apperr.Conflict("DUPLICATE_LOCATION_CODE", "location code already exists in warehouse")
		}
		existing.Name = in.Name
		existing.IsActive = true
		return existing, nil
	}
	loc := &topologydomain.Location{ID: uuid.New(), WarehouseID: in.WarehouseID, Code: in.Code, Name: in.Name, IsActive: true}
	f.locations[loc.ID] = loc
	return loc, nil
}

func (f *fakeRepo) GetLocation(_ context.Context, id uuid.UUID) (*topologydomain.Location, error) {
	loc, ok := f.locations[id]
	if !ok {
		return nil, apperr.NotFound("location not found")
	}
	return loc, nil
}

func (f *fakeRepo) ListLocations(_ context.Context, warehouseID uuid.UUID, activeOnly bool) ([]topologydomain.Location, error) {
	var out []topologydomain.Location
	for _, loc := range f.locations {
		if loc.WarehouseID != warehouseID {
			continue
		}
		if activeOnly && !loc.IsActive {
			continue
		}
		out = append(out, *loc)
	}
	return out, nil
}

func (f *fakeRepo) UpdateLocation(_ context.Context, id uuid.UUID, in topologydomain.UpdateLocationInput) (*topologydomain.Location, error) {
	loc, err := f.GetLocation(context.Background(), id)
	if err != nil {
		return nil, err
	}
	if in.Code != nil {
		loc.Code = *in.Code
	}
	if in.Name != nil {
		loc.Name = *in.Name
	}
	if in.IsActive != nil {
		loc.IsActive = *in.IsActive
	}
	return loc, nil
}

func (f *fakeRepo) DeleteLocation(_ context.Context, id uuid.UUID) error {
	loc, err := f.GetLocation(context.Background(), id)
	if err != nil {
		return err
	}
	loc.IsActive = false
	return nil
}

func TestCreateWarehouse_Validation(t *testing.T) {
	svc := topologyapp.NewTopologyService(&fakeRepo{warehouses: map[uuid.UUID]*topologydomain.Warehouse{}})
	_, err := svc.CreateWarehouse(context.Background(), topologydomain.CreateWarehouseInput{})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestCreateLocation_RequiresWarehouse(t *testing.T) {
	svc := topologyapp.NewTopologyService(&fakeRepo{
		warehouses: map[uuid.UUID]*topologydomain.Warehouse{},
		locations:  map[uuid.UUID]*topologydomain.Location{},
	})
	_, err := svc.CreateLocation(context.Background(), uuid.New().String(), topologydomain.CreateLocationInput{Code: "s1", Name: "Shelf"})
	if err == nil {
		t.Fatal("expected warehouse not found")
	}
}

func TestCreateLocation_ReactivatesSoftDeleted(t *testing.T) {
	whID := uuid.New()
	locID := uuid.New()
	repo := &fakeRepo{
		warehouses: map[uuid.UUID]*topologydomain.Warehouse{
			whID: {ID: whID, Code: "kitchen", Name: "Kitchen", IsActive: true},
		},
		locations: map[uuid.UUID]*topologydomain.Location{
			locID: {ID: locID, WarehouseID: whID, Code: "box-1", Name: "Old", IsActive: false},
		},
	}
	svc := topologyapp.NewTopologyService(repo)

	got, err := svc.CreateLocation(context.Background(), whID.String(), topologydomain.CreateLocationInput{Code: "box-1", Name: "New name"})
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != locID || !got.IsActive || got.Name != "New name" {
		t.Fatalf("expected reactivated location, got %+v", got)
	}
}
