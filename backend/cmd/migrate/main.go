package main

import (
	"context"
	"log"

	"github.com/vutratenko/sklad/internal/platform/config"
	"github.com/vutratenko/sklad/internal/platform/db"
	"github.com/vutratenko/sklad/internal/platform/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	logger.Setup(cfg.AppEnv)

	if err := db.Run(context.Background(), cfg.DatabaseURL); err != nil {
		log.Fatal(err)
	}
	log.Println("migrations applied successfully")
}
