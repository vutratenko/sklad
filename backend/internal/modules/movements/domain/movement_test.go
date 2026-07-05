package domain_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/vutratenko/sklad/internal/modules/movements/domain"
)

func TestValidateMovementInput_Receipt(t *testing.T) {
	to := uuid.New()
	err := domain.ValidateMovementInput(domain.ApplyMovementInput{
		OperationType: domain.OpReceipt,
		DeviceID:      "dev1",
		OperationKey:  "op1",
		Lines: []domain.MovementLine{{
			SKUID: uuid.New(), Quantity: 5, ToLocationID: &to,
		}},
	})
	if err != nil {
		t.Fatalf("expected valid receipt, got %v", err)
	}
}

func TestValidateMovementInput_IssueRequiresReason(t *testing.T) {
	from := uuid.New()
	err := domain.ValidateMovementInput(domain.ApplyMovementInput{
		OperationType: domain.OpIssue,
		DeviceID:      "dev1",
		OperationKey:  "op1",
		Lines: []domain.MovementLine{{
			SKUID: uuid.New(), Quantity: 1, FromLocationID: &from,
		}},
	})
	if err == nil {
		t.Fatal("expected validation error for missing reason")
	}
}

func TestValidateMovementInput_IssueWithReason(t *testing.T) {
	from := uuid.New()
	err := domain.ValidateMovementInput(domain.ApplyMovementInput{
		OperationType: domain.OpIssue,
		ReasonCode:    "used",
		DeviceID:      "dev1",
		OperationKey:  "op1",
		Lines: []domain.MovementLine{{
			SKUID: uuid.New(), Quantity: 1, FromLocationID: &from,
		}},
	})
	if err != nil {
		t.Fatalf("expected valid issue, got %v", err)
	}
}

func TestValidateMovementInput_TransferSameLocation(t *testing.T) {
	loc := uuid.New()
	err := domain.ValidateMovementInput(domain.ApplyMovementInput{
		OperationType: domain.OpTransfer,
		DeviceID:      "dev1",
		OperationKey:  "op1",
		Lines: []domain.MovementLine{{
			SKUID: uuid.New(), Quantity: 1, FromLocationID: &loc, ToLocationID: &loc,
		}},
	})
	if err == nil {
		t.Fatal("expected error for same from/to")
	}
}

func TestValidateMovementInput_TransferValid(t *testing.T) {
	from := uuid.New()
	to := uuid.New()
	err := domain.ValidateMovementInput(domain.ApplyMovementInput{
		OperationType: domain.OpTransfer,
		DeviceID:      "dev1",
		OperationKey:  "op1",
		Lines: []domain.MovementLine{{
			SKUID: uuid.New(), Quantity: 2, FromLocationID: &from, ToLocationID: &to,
		}},
	})
	if err != nil {
		t.Fatalf("expected valid transfer, got %v", err)
	}
}

func TestValidateMovementInput_Adjustment(t *testing.T) {
	to := uuid.New()
	err := domain.ValidateMovementInput(domain.ApplyMovementInput{
		OperationType: domain.OpAdjustment,
		DeviceID:      "dev1",
		OperationKey:  "op1",
		Lines: []domain.MovementLine{{
			SKUID: uuid.New(), Quantity: 3, ToLocationID: &to,
		}},
	})
	if err != nil {
		t.Fatalf("expected valid adjustment, got %v", err)
	}
	from := uuid.New()
	err = domain.ValidateMovementInput(domain.ApplyMovementInput{
		OperationType: domain.OpAdjustment,
		DeviceID:      "dev1",
		OperationKey:  "op2",
		Lines: []domain.MovementLine{{
			SKUID: uuid.New(), Quantity: 1, FromLocationID: &from, ToLocationID: &to,
		}},
	})
	if err == nil {
		t.Fatal("expected error when adjustment has both from and to")
	}
}
