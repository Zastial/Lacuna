// Command ingester est le worker d'ingestion de la Phase 1 (§8 du plan) :
// fetch concurrent des flux, parsing VTT/SRT en segments, calcul de
// rare_ratio. Tourne en boucle (cron interne) sauf si RUN_ONCE=true.
package main

import (
	"context"
	"fmt"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/errgroup"

	"lacuna/internal/config"
	"lacuna/internal/db"
	"lacuna/internal/frequency"
	"lacuna/internal/ingest"
)

const maxConcurrentFeeds = 5

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

	if err := ingest.SeedFeeds(ctx, pool, seedFeeds); err != nil {
		log.Fatalf("seed feeds: %v", err)
	}
	if err := ingest.SeedArticleFeeds(ctx, pool, seedArticleFeeds); err != nil {
		log.Fatalf("seed article feeds: %v", err)
	}

	interval := config.Duration("INGEST_INTERVAL", 6*time.Hour)
	minRefetch := config.Duration("MIN_REFETCH_INTERVAL", 15*time.Minute)
	runOnce := config.Bool("RUN_ONCE", false)

	for {
		runCycle(ctx, pool, rdb, minRefetch)
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

// runCycle traite tous les flux connus, en parallèle borné, en sautant ceux
// ingérés récemment (garde-fou Redis, cf. §5 : "Redis (cache feeds/ETag)").
// Une erreur sur un flux individuel est loguée mais n'interrompt pas le
// cycle — un podcast cassé ne doit pas bloquer les autres.
func runCycle(ctx context.Context, pool *pgxpool.Pool, rdb *redis.Client, minRefetch time.Duration) {
	feeds, err := ingest.LoadFeeds(ctx, pool)
	if err != nil {
		log.Printf("load feeds: %v", err)
		return
	}
	if len(feeds) == 0 {
		log.Println("no feeds to ingest")
		return
	}

	rankSets := map[string]frequency.RankSet{}
	for _, f := range feeds {
		key := f.Lang + "/" + f.Level
		if _, ok := rankSets[key]; ok {
			continue
		}
		set, err := frequency.LoadRankSet(ctx, pool, f.Lang, frequency.Thresholds[f.Level])
		if err != nil {
			log.Printf("load rank set for %s: %v", key, err)
			continue
		}
		rankSets[key] = set
	}

	sem := make(chan struct{}, maxConcurrentFeeds)
	g, gctx := errgroup.WithContext(ctx)

	for _, f := range feeds {
		f := f
		g.Go(func() error {
			sem <- struct{}{}
			defer func() { <-sem }()

			lockKey := fmt.Sprintf("lacuna:lastingest:%d", f.ID)
			acquired, err := rdb.SetNX(gctx, lockKey, time.Now().Format(time.RFC3339), minRefetch).Result()
			if err != nil {
				log.Printf("feed %d (%s): redis guard error, ingesting anyway: %v", f.ID, f.Title, err)
			} else if !acquired {
				log.Printf("feed %d (%s): skipped, ingéré il y a moins de %s", f.ID, f.Title, minRefetch)
				return nil
			}

			res, err := ingest.IngestFeed(gctx, pool, f, rankSets[f.Lang+"/"+f.Level])
			if err != nil {
				log.Printf("feed %d (%s): %v", f.ID, f.Title, err)
				return nil // ne pas interrompre les autres flux
			}
			switch {
			case res.NotModified:
				log.Printf("feed %d (%s): not modified", f.ID, f.Title)
			default:
				log.Printf("feed %d (%s): %d épisodes vus, %d segmentés, %d segments insérés",
					f.ID, f.Title, res.EpisodesUpserted, res.EpisodesSegmented, res.SegmentsInserted)
			}
			return nil
		})
	}
	_ = g.Wait()
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
