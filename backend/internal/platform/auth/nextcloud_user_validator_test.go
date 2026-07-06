package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNextcloudUserValidator_ValidAccessToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/ocs/v2.php/cloud/user" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if r.URL.Query().Get("format") != "json" {
			t.Fatalf("expected format=json, got %s", r.URL.RawQuery)
		}
		if r.Header.Get("Authorization") != "Bearer opaque-token" {
			t.Fatalf("unexpected auth header %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("OCS-APIRequest") != "true" {
			t.Fatal("expected OCS-APIRequest header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ocs":{"meta":{"statuscode":100},"data":{"id":"vv","displayname":"V V","email":"vv@example.test"}}}`))
	}))
	defer server.Close()

	validator := NewNextcloudUserValidator(server.URL)
	user, err := validator.Validate(context.Background(), "opaque-token")
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if user.ID != "vv" || user.Name != "V V" || user.Email != "vv@example.test" {
		t.Fatalf("unexpected user: %+v", user)
	}
}

func TestNextcloudUserValidator_RejectedToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ocs":{"meta":{"statuscode":997,"message":"not authorized"},"data":{}}}`))
	}))
	defer server.Close()

	validator := NewNextcloudUserValidator(server.URL)
	if _, err := validator.Validate(context.Background(), "bad-token"); err == nil {
		t.Fatal("expected validation error")
	}
}

type failingValidator struct{}

func (failingValidator) Validate(context.Context, string) (User, error) {
	return User{}, fmt.Errorf("failed")
}

type staticUserValidator struct {
	user User
}

func (v staticUserValidator) Validate(context.Context, string) (User, error) {
	return v.user, nil
}

func TestFallbackValidator_UsesNextValidatorAfterFailure(t *testing.T) {
	validator := NewFallbackValidator(
		failingValidator{},
		staticUserValidator{user: User{ID: "fallback-user"}},
	)

	user, err := validator.Validate(context.Background(), "token")
	if err != nil {
		t.Fatalf("Validate: %v", err)
	}
	if user.ID != "fallback-user" {
		t.Fatalf("unexpected user %+v", user)
	}
}
