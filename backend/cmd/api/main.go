package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	catalogapp "github.com/vutratenko/sklad/internal/modules/catalog/application"
	catalogpg "github.com/vutratenko/sklad/internal/modules/catalog/infrastructure/postgres"
	lotpg "github.com/vutratenko/sklad/internal/modules/lots/infrastructure/postgres"
	moveapp "github.com/vutratenko/sklad/internal/modules/movements/application"
	stockpg "github.com/vutratenko/sklad/internal/modules/stockview/infrastructure/postgres"
	syncapp "github.com/vutratenko/sklad/internal/modules/sync/application"
	syncpg "github.com/vutratenko/sklad/internal/modules/sync/infrastructure/postgres"
	toppg "github.com/vutratenko/sklad/internal/modules/topology/infrastructure/postgres"
	topologyapp "github.com/vutratenko/sklad/internal/modules/topology/application"
	"github.com/vutratenko/sklad/internal/platform/auth"
	"github.com/vutratenko/sklad/internal/platform/config"
	"github.com/vutratenko/sklad/internal/platform/db"
	"github.com/vutratenko/sklad/internal/platform/health"
	apihttp "github.com/vutratenko/sklad/internal/platform/http"
	"github.com/vutratenko/sklad/internal/platform/logger"
	"github.com/vutratenko/sklad/internal/platform/media"
	sharedpg "github.com/vutratenko/sklad/internal/shared/postgres"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	logger.Setup(cfg.AppEnv)

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		log.Fatal(err)
	}
	defer pool.Close()

	migrationDir := db.DefaultMigrationsDir()
	if err := pool.RunMigrations(ctx, migrationDir); err != nil {
		slog.Error("migration failed", "error", err)
		log.Fatal(err)
	}
	slog.Info("migrations applied", "dir", migrationDir)

	adapter := &sharedpg.PoolAdapter{Pool: pool.Pool}
	skuRepo := catalogpg.NewSKURepository(adapter)
	topoRepo := toppg.NewTopologyRepository(adapter)
	topoSvc := topologyapp.NewTopologyService(topoRepo)
	lotRepo := lotpg.NewLotRepository(adapter)
	stockRepo := stockpg.NewStockViewRepository(adapter)
	eventRepo := syncpg.NewEventRepository(adapter)

	catalogSvc := catalogapp.NewCatalogService(skuRepo)
	moveSvc := moveapp.NewMovementService(adapter)
	syncSvc := syncapp.NewSyncService(moveSvc, eventRepo)

	mediaStorage, err := media.NewStorage(cfg.MediaDir)
	if err != nil {
		slog.Error("media storage init failed", "error", err)
		log.Fatal(err)
	}

	h := &apihttp.Handlers{
		Catalog:   catalogSvc,
		Topology:  topoSvc,
		Lots:      lotRepo,
		Movements: moveSvc,
		StockView: stockRepo,
		Sync:      syncSvc,
		Media:     mediaStorage,
	}

	mux := http.NewServeMux()
	healthHandler := health.NewHandler(pool)
	mux.Handle("GET /health", healthHandler)
	mux.Handle("GET /api/v1/health", healthHandler)
	mux.Handle("GET /api/v1/media/{file}", http.StripPrefix("/api/v1/media/", http.FileServer(http.Dir(mediaStorage.Dir()))))
	mux.HandleFunc("GET /api/v1/auth/oidc/config", auth.OIDCConfigHandler(cfg))
	h.Register(mux)

	validator := auth.NewValidator(cfg)
	authMw := auth.NewMiddleware(auth.MiddlewareConfig{
		DevBypassEnabled: cfg.DevBypassEnabled(),
	}, validator)
	handler := corsMiddleware(authMw.Wrap(mux))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: handler}
	go func() {
		slog.Info("starting server", "addr", cfg.HTTPAddr, "env", cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
