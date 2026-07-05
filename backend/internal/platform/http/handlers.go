package http

import (
	"net/http"
	"strconv"

	catalogapp "github.com/vutratenko/sklad/internal/modules/catalog/application"
	catalogdomain "github.com/vutratenko/sklad/internal/modules/catalog/domain"
	lotdomain "github.com/vutratenko/sklad/internal/modules/lots/domain"
	moveapp "github.com/vutratenko/sklad/internal/modules/movements/application"
	movedomain "github.com/vutratenko/sklad/internal/modules/movements/domain"
	stockdomain "github.com/vutratenko/sklad/internal/modules/stockview/domain"
	syncapp "github.com/vutratenko/sklad/internal/modules/sync/application"
	topologyapp "github.com/vutratenko/sklad/internal/modules/topology/application"
	topologydomain "github.com/vutratenko/sklad/internal/modules/topology/domain"
	"github.com/vutratenko/sklad/internal/platform/auth"
	"github.com/vutratenko/sklad/internal/platform/httpx"
	"github.com/vutratenko/sklad/internal/platform/media"
	"github.com/vutratenko/sklad/internal/shared/apperr"
	"github.com/google/uuid"
)

type Handlers struct {
	Catalog   *catalogapp.CatalogService
	Topology  *topologyapp.TopologyService
	Lots      lotdomain.Repository
	Movements *moveapp.MovementService
	StockView stockdomain.Repository
	Sync      *syncapp.SyncService
	Media     *media.Storage
}

func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/auth/me", h.authMe)
	mux.HandleFunc("GET /api/v1/skus", h.listSKUs)
	mux.HandleFunc("POST /api/v1/skus", h.createSKU)
	mux.HandleFunc("GET /api/v1/skus/{id}", h.getSKU)
	mux.HandleFunc("PATCH /api/v1/skus/{id}", h.patchSKU)
	mux.HandleFunc("DELETE /api/v1/skus/{id}", h.deleteSKU)
	mux.HandleFunc("POST /api/v1/skus/{id}/barcodes", h.addSKUBarcode)
	mux.HandleFunc("DELETE /api/v1/skus/{id}/barcodes/{barcode}", h.removeSKUBarcode)
	mux.HandleFunc("POST /api/v1/skus/{id}/photo", h.uploadSKUPhoto)
	mux.HandleFunc("GET /api/v1/barcodes/{barcode}", h.lookupBarcode)
	mux.HandleFunc("GET /api/v1/warehouses", h.listWarehouses)
	mux.HandleFunc("POST /api/v1/warehouses", h.createWarehouse)
	mux.HandleFunc("GET /api/v1/warehouses/{id}", h.getWarehouse)
	mux.HandleFunc("PATCH /api/v1/warehouses/{id}", h.patchWarehouse)
	mux.HandleFunc("DELETE /api/v1/warehouses/{id}", h.deleteWarehouse)
	mux.HandleFunc("GET /api/v1/warehouses/{id}/locations", h.listLocations)
	mux.HandleFunc("POST /api/v1/warehouses/{id}/locations", h.createLocation)
	mux.HandleFunc("GET /api/v1/locations/{id}", h.getLocation)
	mux.HandleFunc("PATCH /api/v1/locations/{id}", h.patchLocation)
	mux.HandleFunc("DELETE /api/v1/locations/{id}", h.deleteLocation)
	mux.HandleFunc("GET /api/v1/stocks", h.listStocks)
	mux.HandleFunc("POST /api/v1/movements", h.createMovement)
	mux.HandleFunc("GET /api/v1/movements", h.listMovements)
	mux.HandleFunc("GET /api/v1/lots", h.listLots)
	mux.HandleFunc("POST /api/v1/lots", h.createLot)
	mux.HandleFunc("POST /api/v1/sync/push", h.syncPush)
	mux.HandleFunc("GET /api/v1/sync/pull", h.syncPull)
}

func (h *Handlers) authMe(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	httpx.WriteJSON(w, http.StatusOK, u)
}

func (h *Handlers) listSKUs(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active_only") == "true"
	items, err := h.Catalog.List(r.Context(), r.URL.Query().Get("q"), activeOnly)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handlers) createSKU(w http.ResponseWriter, r *http.Request) {
	var in catalogdomain.CreateSKUInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	sku, err := h.Catalog.Create(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, sku)
}

func (h *Handlers) getSKU(w http.ResponseWriter, r *http.Request) {
	sku, err := h.Catalog.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sku)
}

func (h *Handlers) patchSKU(w http.ResponseWriter, r *http.Request) {
	var in catalogdomain.UpdateSKUInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	sku, err := h.Catalog.Update(r.Context(), r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sku)
}

func (h *Handlers) deleteSKU(w http.ResponseWriter, r *http.Request) {
	if err := h.Catalog.Delete(r.Context(), r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) addSKUBarcode(w http.ResponseWriter, r *http.Request) {
	var in catalogdomain.AddBarcodeInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	sku, err := h.Catalog.AddBarcode(r.Context(), r.PathValue("id"), in.Barcode)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sku)
}

func (h *Handlers) removeSKUBarcode(w http.ResponseWriter, r *http.Request) {
	sku, err := h.Catalog.RemoveBarcode(r.Context(), r.PathValue("id"), r.PathValue("barcode"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sku)
}

func (h *Handlers) uploadSKUPhoto(w http.ResponseWriter, r *http.Request) {
	if h.Media == nil {
		httpx.WriteError(w, r, apperr.Validation("media storage not configured"))
		return
	}
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		httpx.WriteError(w, r, apperr.Validation("invalid multipart form"))
		return
	}
	file, header, err := r.FormFile("photo")
	if err != nil {
		httpx.WriteError(w, r, apperr.Validation("photo field is required"))
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	photoURL, err := h.Media.SaveSKUPhoto(r.PathValue("id"), contentType, file)
	if err != nil {
		httpx.WriteError(w, r, apperr.Validation(err.Error()))
		return
	}
	sku, err := h.Catalog.Update(r.Context(), r.PathValue("id"), catalogdomain.UpdateSKUInput{
		PhotoURL: &photoURL,
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sku)
}

func (h *Handlers) lookupBarcode(w http.ResponseWriter, r *http.Request) {
	sku, err := h.Catalog.FindByBarcode(r.Context(), r.PathValue("barcode"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	stocks, _ := h.StockView.ListStocks(r.Context(), stockdomain.StockFilter{SKUID: &sku.ID})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"barcode": r.PathValue("barcode"), "sku": sku, "stocks": stocks})
}

func (h *Handlers) listWarehouses(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active_only") == "true"
	items, err := h.Topology.ListWarehouses(r.Context(), activeOnly)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handlers) createWarehouse(w http.ResponseWriter, r *http.Request) {
	var in topologydomain.CreateWarehouseInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ws, err := h.Topology.CreateWarehouse(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, ws)
}

func (h *Handlers) getWarehouse(w http.ResponseWriter, r *http.Request) {
	ws, err := h.Topology.GetWarehouse(r.Context(), r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ws)
}

func (h *Handlers) patchWarehouse(w http.ResponseWriter, r *http.Request) {
	var in topologydomain.UpdateWarehouseInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	ws, err := h.Topology.UpdateWarehouse(r.Context(), r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ws)
}

func (h *Handlers) deleteWarehouse(w http.ResponseWriter, r *http.Request) {
	if err := h.Topology.DeleteWarehouse(r.Context(), r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) listLocations(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active_only") == "true"
	items, err := h.Topology.ListLocations(r.Context(), r.PathValue("id"), activeOnly)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handlers) createLocation(w http.ResponseWriter, r *http.Request) {
	var in topologydomain.CreateLocationInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	loc, err := h.Topology.CreateLocation(r.Context(), r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, loc)
}

func (h *Handlers) getLocation(w http.ResponseWriter, r *http.Request) {
	loc, err := h.Topology.GetLocation(r.Context(), r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, loc)
}

func (h *Handlers) patchLocation(w http.ResponseWriter, r *http.Request) {
	var in topologydomain.UpdateLocationInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	loc, err := h.Topology.UpdateLocation(r.Context(), r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, loc)
}

func (h *Handlers) deleteLocation(w http.ResponseWriter, r *http.Request) {
	if err := h.Topology.DeleteLocation(r.Context(), r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) listStocks(w http.ResponseWriter, r *http.Request) {
	f := stockdomain.StockFilter{Query: r.URL.Query().Get("q")}
	if v := r.URL.Query().Get("sku_id"); v != "" {
		id, _ := uuid.Parse(v)
		f.SKUID = &id
	}
	if v := r.URL.Query().Get("warehouse_id"); v != "" {
		id, _ := uuid.Parse(v)
		f.WarehouseID = &id
	}
	if v := r.URL.Query().Get("location_id"); v != "" {
		id, _ := uuid.Parse(v)
		f.LocationID = &id
	}
	items, err := h.StockView.ListStocks(r.Context(), f)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

type movementRequest struct {
	OperationType  string `json:"operation_type"`
	ReasonCode     string `json:"reason_code"`
	DeviceID       string `json:"device_id"`
	OperationKey   string `json:"operation_key"`
	Lines          []struct {
		SKUID          string  `json:"sku_id"`
		LotID          *string `json:"lot_id"`
		Quantity       int     `json:"quantity"`
		FromLocationID *string `json:"from_location_id"`
		ToLocationID   *string `json:"to_location_id"`
	} `json:"lines"`
}

func (h *Handlers) createMovement(w http.ResponseWriter, r *http.Request) {
	var req movementRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	hash := moveapp.HashPayload(req)
	lines := make([]movedomain.MovementLine, 0, len(req.Lines))
	for _, l := range req.Lines {
		skuID, _ := uuid.Parse(l.SKUID)
		line := movedomain.MovementLine{SKUID: skuID, Quantity: l.Quantity}
		if l.LotID != nil {
			id, _ := uuid.Parse(*l.LotID)
			line.LotID = &id
		}
		if l.FromLocationID != nil {
			id, _ := uuid.Parse(*l.FromLocationID)
			line.FromLocationID = &id
		}
		if l.ToLocationID != nil {
			id, _ := uuid.Parse(*l.ToLocationID)
			line.ToLocationID = &id
		}
		lines = append(lines, line)
	}
	user, _ := auth.UserFromContext(r.Context())
	res, err := h.Movements.Apply(r.Context(), movedomain.ApplyMovementInput{
		OperationType: movedomain.OperationType(req.OperationType),
		ReasonCode:    req.ReasonCode,
		Lines:         lines,
		DeviceID:      req.DeviceID,
		OperationKey:  req.OperationKey,
		PayloadHash:   hash,
		CreatedBy:     user.ID,
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handlers) listMovements(w http.ResponseWriter, r *http.Request) {
	f := stockdomain.MovementFilter{}
	if v := r.URL.Query().Get("sku_id"); v != "" {
		id, _ := uuid.Parse(v)
		f.SKUID = &id
	}
	if v := r.URL.Query().Get("operation_type"); v != "" {
		f.OperationType = &v
	}
	items, err := h.StockView.ListMovements(r.Context(), f)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handlers) listLots(w http.ResponseWriter, r *http.Request) {
	var skuID *uuid.UUID
	if v := r.URL.Query().Get("sku_id"); v != "" {
		id, _ := uuid.Parse(v)
		skuID = &id
	}
	items, err := h.Lots.List(r.Context(), skuID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handlers) createLot(w http.ResponseWriter, r *http.Request) {
	var in lotdomain.CreateLotInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	lot, err := h.Lots.Create(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, lot)
}

func (h *Handlers) syncPush(w http.ResponseWriter, r *http.Request) {
	var req syncapp.SyncPushRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	resp, err := h.Sync.Push(r.Context(), req)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handlers) syncPull(w http.ResponseWriter, r *http.Request) {
	cursor, _ := strconv.ParseInt(r.URL.Query().Get("cursor"), 10, 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	resp, err := h.Sync.Pull(r.Context(), cursor, limit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
