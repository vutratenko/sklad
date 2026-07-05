package application

import (
	"github.com/google/uuid"
	"github.com/vutratenko/sklad/internal/shared/apperr"
)

func parseUUID(s string) (uuid.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, apperr.Validation("invalid uuid")
	}
	return id, nil
}
