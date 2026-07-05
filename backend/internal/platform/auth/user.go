package auth

import "context"

type contextKey string

const UserContextKey contextKey = "user"

type User struct {
	ID    string `json:"id"`
	Email string `json:"email,omitempty"`
	Name  string `json:"name,omitempty"`
}

func UserFromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(UserContextKey).(User)
	return u, ok
}
