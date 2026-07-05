package application

import (
	"context"

	"github.com/google/uuid"
	topologydomain "github.com/vutratenko/sklad/internal/modules/topology/domain"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type TopologyService struct {
	repo topologydomain.Repository
}

func NewTopologyService(repo topologydomain.Repository) *TopologyService {
	return &TopologyService{repo: repo}
}

func (s *TopologyService) CreateWarehouse(ctx context.Context, in topologydomain.CreateWarehouseInput) (*topologydomain.Warehouse, error) {
	if in.Code == "" || in.Name == "" {
		return nil, apperr.Validation("code and name are required")
	}
	return s.repo.CreateWarehouse(ctx, in)
}

func (s *TopologyService) GetWarehouse(ctx context.Context, id string) (*topologydomain.Warehouse, error) {
	uid, err := parseUUID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.GetWarehouse(ctx, uid)
}

func (s *TopologyService) ListWarehouses(ctx context.Context, activeOnly bool) ([]topologydomain.Warehouse, error) {
	return s.repo.ListWarehouses(ctx, activeOnly)
}

func (s *TopologyService) UpdateWarehouse(ctx context.Context, id string, in topologydomain.UpdateWarehouseInput) (*topologydomain.Warehouse, error) {
	uid, err := parseUUID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateWarehouse(ctx, uid, in)
}

func (s *TopologyService) DeleteWarehouse(ctx context.Context, id string) error {
	uid, err := parseUUID(id)
	if err != nil {
		return err
	}
	return s.repo.DeleteWarehouse(ctx, uid)
}

func (s *TopologyService) CreateLocation(ctx context.Context, warehouseID string, in topologydomain.CreateLocationInput) (*topologydomain.Location, error) {
	wid, err := parseUUID(warehouseID)
	if err != nil {
		return nil, err
	}
	if in.Code == "" || in.Name == "" {
		return nil, apperr.Validation("code and name are required")
	}
	in.WarehouseID = wid
	if _, err := s.repo.GetWarehouse(ctx, wid); err != nil {
		return nil, err
	}
	return s.repo.CreateLocation(ctx, in)
}

func (s *TopologyService) GetLocation(ctx context.Context, id string) (*topologydomain.Location, error) {
	uid, err := parseUUID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.GetLocation(ctx, uid)
}

func (s *TopologyService) ListLocations(ctx context.Context, warehouseID string, activeOnly bool) ([]topologydomain.Location, error) {
	wid, err := parseUUID(warehouseID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListLocations(ctx, wid, activeOnly)
}

func (s *TopologyService) UpdateLocation(ctx context.Context, id string, in topologydomain.UpdateLocationInput) (*topologydomain.Location, error) {
	uid, err := parseUUID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateLocation(ctx, uid, in)
}

func (s *TopologyService) DeleteLocation(ctx context.Context, id string) error {
	uid, err := parseUUID(id)
	if err != nil {
		return err
	}
	return s.repo.DeleteLocation(ctx, uid)
}

func parseUUID(s string) (uuid.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, apperr.Validation("invalid uuid")
	}
	return id, nil
}
