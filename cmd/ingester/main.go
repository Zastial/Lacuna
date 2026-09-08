// Command ingester est le worker d'ingestion de la Phase 1 (§8 du plan) :
// fetch concurrent des flux, parsing VTT/SRT en segments, calcul de
// rare_ratio. Tourne en boucle (cron interne) sauf si RUN_ONCE=true.
package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"lacuna/internal/config"
	"lacuna/internal/db"
	"lacuna/internal/frequency"
	"lacuna/internal/ingest"
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

	rdb := redis.NewClient(&redis.Options{Addr: mustParseRedisAddr(config.RedisURL())})
	defer rdb.Close()

	if err := frequency.Import(ctx, pool, []string{"en", "es", "it"}); err != nil {
		log.Fatalf("import frequency lists: %v", err)
	}

	if err := ingest.SeedArticleFeeds(ctx, pool, seedArticleFeeds); err != nil {
		log.Fatalf("seed article feeds: %v", err)
	}
	if err := ingest.SeedVideoChannels(ctx, pool, videoChannels); err != nil {
		log.Fatalf("seed video channels: %v", err)
	}

	interval := config.Duration("INGEST_INTERVAL", 6*time.Hour)
	runOnce := config.Bool("RUN_ONCE", false)

	for {
		runVideoCycle(ctx, pool)
		runArticleCycle(ctx, pool)

		if runOnce {
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
	}
}

// runVideoCycle rafraîchit les chaînes YouTube suivies. Même profil que les
// articles — une poignée de flux Atom, cache conditionnel, pas besoin du
// garde-fou Redis.
func runVideoCycle(ctx context.Context, pool *pgxpool.Pool) {
	channels, err := ingest.LoadVideoChannels(ctx, pool)
	if err != nil {
		log.Printf("load video channels: %v", err)
		return
	}

	for _, c := range channels {
		res, err := ingest.IngestVideoChannel(ctx, pool, c)
		if err != nil {
			log.Printf("chaîne %d (%s): %v", c.ID, c.Name, err)
			continue
		}
		if res.NotModified {
			log.Printf("chaîne %d (%s): non modifiée", c.ID, c.Name)
		} else {
			log.Printf("chaîne %d (%s): %d vidéos vues", c.ID, c.Name, res.Fetched)
		}
	}
}

// runArticleCycle traite les flux d'articles (peu nombreux, un par grand
// média — pas besoin du garde-fou Redis ni de la concurrence bornée de
// runCycle : le cache conditionnel ETag suffit à rendre les passages
// fréquents peu coûteux).
func runArticleCycle(ctx context.Context, pool *pgxpool.Pool) {
	feeds, err := ingest.LoadArticleFeeds(ctx, pool)
	if err != nil {
		log.Printf("load article feeds: %v", err)
		return
	}

	rankSets := map[string]frequency.RankSet{}
	for _, f := range feeds {
		if _, ok := rankSets[f.Lang]; ok {
			continue
		}
		set, err := frequency.LoadRankSet(ctx, pool, f.Lang, frequency.Thresholds["native"])
		if err != nil {
			log.Printf("load rank set for article lang %s: %v", f.Lang, err)
			continue
		}
		rankSets[f.Lang] = set
	}

	for _, f := range feeds {
		res, err := ingest.IngestArticleFeed(ctx, pool, f, rankSets[f.Lang])
		if err != nil {
			log.Printf("article feed %d (%s): %v", f.ID, f.SourceName, err)
			continue
		}
		if res.NotModified {
			log.Printf("article feed %d (%s): not modified", f.ID, f.SourceName)
		} else {
			log.Printf("article feed %d (%s): %d articles vus", f.ID, f.SourceName, res.ArticlesUpserted)
		}
	}
}

func mustParseRedisAddr(url string) string {
	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Fatalf("parse REDIS_URL: %v", err)
	}
	return opt.Addr
}
