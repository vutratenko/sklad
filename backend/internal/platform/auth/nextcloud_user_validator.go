package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type NextcloudUserValidator struct {
	userURL string
	client  *http.Client
}

type nextcloudUserResponse struct {
	OCS struct {
		Meta struct {
			StatusCode int    `json:"statuscode"`
			Message    string `json:"message"`
		} `json:"meta"`
		Data struct {
			ID          string `json:"id"`
			DisplayName string `json:"displayname"`
			Email       string `json:"email"`
		} `json:"data"`
	} `json:"ocs"`
}

func NewNextcloudUserValidator(issuer string) *NextcloudUserValidator {
	return &NextcloudUserValidator{
		userURL: DefaultNextcloudUserURL(issuer),
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (v *NextcloudUserValidator) Validate(ctx context.Context, rawToken string) (User, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.userURL, nil)
	if err != nil {
		return User{}, err
	}
	req.Header.Set("Authorization", "Bearer "+rawToken)
	req.Header.Set("OCS-APIRequest", "true")
	req.Header.Set("Accept", "application/json")

	resp, err := v.client.Do(req)
	if err != nil {
		return User{}, fmt.Errorf("fetch nextcloud user: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return User{}, err
	}
	if resp.StatusCode != http.StatusOK {
		return User{}, fmt.Errorf("fetch nextcloud user: status %d", resp.StatusCode)
	}

	var doc nextcloudUserResponse
	if err := json.Unmarshal(body, &doc); err != nil {
		return User{}, fmt.Errorf("parse nextcloud user: %w", err)
	}
	if doc.OCS.Meta.StatusCode != 100 && doc.OCS.Meta.StatusCode != http.StatusOK {
		return User{}, fmt.Errorf("nextcloud user rejected token: %s", doc.OCS.Meta.Message)
	}
	if doc.OCS.Data.ID == "" {
		return User{}, fmt.Errorf("nextcloud user response missing id")
	}
	return User{
		ID:    doc.OCS.Data.ID,
		Email: doc.OCS.Data.Email,
		Name:  doc.OCS.Data.DisplayName,
	}, nil
}

func DefaultNextcloudUserURL(issuer string) string {
	base := trimSlash(issuer)
	return base + "/ocs/v2.php/cloud/user?" + url.Values{"format": []string{"json"}}.Encode()
}
