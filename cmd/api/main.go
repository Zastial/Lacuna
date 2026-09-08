// Command api sert l'API JSON en lecture (§8 Phase 1).
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"

	"lacuna/internal/ai"
	"lacuna/internal/apihttp"
	"lacuna/internal/config"
	"lacuna/internal/db"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	dbURL, err := config.DatabaseURL()
	if err != nil {
		log.Fatal(err)
	}

	if err := db.RunMigrations(dbURL); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	pool, err := db.NewPool(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	addr := config.APIAddr()
	srv := &http.Server{Addr: addr, Handler: apihttp.NewMux(pool, ai.NewClient(config.String("GEMINI_API_KEY", "")))}

	go func() {
		<-ctx.Done()
		_ = srv.Close()
	}()

	log.Printf("api listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("serve: %v", err)
	}
}
