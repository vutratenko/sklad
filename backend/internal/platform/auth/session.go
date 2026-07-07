package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const SessionCookieName = "sklad_session"

type SessionManager struct {
	secret []byte
	ttl    time.Duration
	secure bool
	now    func() time.Time
}

type sessionPayload struct {
	User      User  `json:"user"`
	ExpiresAt int64 `json:"exp"`
}

func NewSessionManager(secret string, ttl time.Duration, secure bool) *SessionManager {
	if strings.TrimSpace(secret) == "" || ttl <= 0 {
		return nil
	}
	return &SessionManager{
		secret: []byte(secret),
		ttl:    ttl,
		secure: secure,
		now:    time.Now,
	}
}

func (m *SessionManager) SetCookie(w http.ResponseWriter, user User) (time.Time, error) {
	expiresAt := m.now().Add(m.ttl).UTC()
	payload := sessionPayload{User: user, ExpiresAt: expiresAt.Unix()}
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return time.Time{}, err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(rawPayload)
	cookie := &http.Cookie{
		Name:     SessionCookieName,
		Value:    encodedPayload + "." + m.sign(encodedPayload),
		Path:     "/",
		MaxAge:   int(m.ttl.Seconds()),
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   m.secure,
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(w, cookie)
	return expiresAt, nil
}

func (m *SessionManager) ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0).UTC(),
		HttpOnly: true,
		Secure:   m.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (m *SessionManager) UserFromRequest(r *http.Request) (User, error) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return User{}, err
	}
	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return User{}, fmt.Errorf("invalid session format")
	}
	if !hmac.Equal([]byte(parts[1]), []byte(m.sign(parts[0]))) {
		return User{}, fmt.Errorf("invalid session signature")
	}
	rawPayload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return User{}, err
	}
	var payload sessionPayload
	if err := json.Unmarshal(rawPayload, &payload); err != nil {
		return User{}, err
	}
	if payload.User.ID == "" {
		return User{}, fmt.Errorf("session user is empty")
	}
	if payload.ExpiresAt <= m.now().Unix() {
		return User{}, fmt.Errorf("session expired")
	}
	return payload.User, nil
}

func (m *SessionManager) sign(encodedPayload string) string {
	mac := hmac.New(sha256.New, m.secret)
	_, _ = mac.Write([]byte(encodedPayload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
