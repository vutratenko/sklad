package domain

import (
	"time"

	"github.com/google/uuid"
)

type OperationType string

const (
	OpReceipt    OperationType = "receipt"
	OpIssue      OperationType = "issue"
	OpTransfer   OperationType = "transfer"
	OpAdjustment OperationType = "adjustment"
)

var validIssueReasons = map[string]bool{
	"used":     true,
	"spoiled":  true,
	"gifted":   true,
	"lost":     true,
	"other":    true,
}

type MovementLine struct {
	SKUID          uuid.UUID
	LotID          *uuid.UUID
	Quantity       int
	FromLocationID *uuid.UUID
	ToLocationID   *uuid.UUID
}

type ApplyMovementInput struct {
	OperationType  OperationType
	ReasonCode     string
	Lines          []MovementLine
	DeviceID       string
	OperationKey   string
	PayloadHash    string
	CreatedBy      string
	EffectiveAt    time.Time
}

func ValidateMovementInput(in ApplyMovementInput) error {
	if in.DeviceID == "" || in.OperationKey == "" {
		return ErrValidation("device_id and operation_key are required")
	}
	if len(in.Lines) == 0 {
		return ErrValidation("at least one movement line required")
	}
	for _, line := range in.Lines {
		if line.Quantity <= 0 {
			return ErrValidation("quantity must be positive")
		}
	}
	switch in.OperationType {
	case OpReceipt:
		for _, l := range in.Lines {
			if l.ToLocationID == nil || l.FromLocationID != nil {
				return ErrValidation("receipt requires to_location only")
			}
		}
	case OpIssue:
		if in.ReasonCode == "" || !validIssueReasons[in.ReasonCode] {
			return ErrValidation("issue requires valid reason_code")
		}
		for _, l := range in.Lines {
			if l.FromLocationID == nil || l.ToLocationID != nil {
				return ErrValidation("issue requires from_location only")
			}
		}
	case OpTransfer:
		for _, l := range in.Lines {
			if l.FromLocationID == nil || l.ToLocationID == nil {
				return ErrValidation("transfer requires from and to locations")
			}
			if *l.FromLocationID == *l.ToLocationID {
				return ErrValidation("from and to must differ")
			}
		}
	case OpAdjustment:
		for _, l := range in.Lines {
			hasFrom := l.FromLocationID != nil
			hasTo := l.ToLocationID != nil
			if hasFrom == hasTo {
				return ErrValidation("adjustment requires exactly one of from/to")
			}
		}
	default:
		return ErrValidation("unknown operation type")
	}
	return nil
}

type DomainError struct {
	Message string
}

func (e *DomainError) Error() string { return e.Message }

func ErrValidation(msg string) error {
	return &DomainError{Message: msg}
}
