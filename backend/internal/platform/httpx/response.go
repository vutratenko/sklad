package httpx

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/vutratenko/sklad/internal/shared/apperr"
)

type ErrorResponse struct {
	ErrorCode string         `json:"error_code"`
	Message   string         `json:"message"`
	Details   map[string]any `json:"details,omitempty"`
	RequestID string         `json:"request_id"`
	Timestamp string         `json:"timestamp"`
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	reqID := r.Header.Get("X-Request-ID")
	if reqID == "" {
		reqID = "unknown"
	}
	if ae, ok := err.(*apperr.AppError); ok {
		WriteJSON(w, ae.HTTPStatus, ErrorResponse{
			ErrorCode: ae.Code,
			Message:   ae.Message,
			Details:   ae.Details,
			RequestID: reqID,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})
		return
	}
	WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
		ErrorCode: "INTERNAL_ERROR",
		Message:   err.Error(),
		RequestID: reqID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func DecodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}
