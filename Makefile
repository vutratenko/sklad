.PHONY: up down test test-unit test-integration test-frontend test-all lint build migrate health clean frontend-dev frontend-build

up:
	docker compose -f infra/docker/docker-compose.yml up --build -d

down:
	docker compose -f infra/docker/docker-compose.yml down

build:
	cd backend && go build -o bin/api ./cmd/api && go build -o bin/migrate ./cmd/migrate

migrate:
	cd backend && go run ./cmd/migrate

health:
	curl -sf http://localhost:8080/health && echo " OK"

test: test-all

test-unit:
	cd backend && go test ./... -short -count=1

test-integration:
	cd backend && go test ./... -tags=integration -count=1

test-frontend:
	cd frontend && npm test

test-all: test-unit test-integration test-frontend

lint:
	cd backend && go vet ./...
	cd frontend && npm run lint 2>/dev/null || true

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

clean:
	rm -rf backend/bin frontend/dist
