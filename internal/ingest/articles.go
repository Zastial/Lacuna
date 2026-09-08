package ingest

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"lacuna/internal/frequency"
	"lacuna/internal/models"
	"lacuna/internal/rssfeed"
)

// maxArticlesPerFeed borne le nombre d'articles traités par passage : les
// flux servent souvent bien plus que ce qu'on affiche, inutile de tout
// écrire en base à chaque cycle.
const maxArticlesPerFeed = 20

// nullIfEmpty rend NULL plutôt qu'une chaîne vide : un ETag absent doit se
// distinguer d'un ETag vide au prochain GET conditionnel.
func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

type SeedArticleFeed struct {
	RSSURL     string
	SourceName string
	Lang       string
	Sport      string
}

// SeedArticleFeeds insère les flux d'articles connus s'ils n'y sont pas déjà
// (idempotent, comme SeedFeeds pour les podcasts).
func SeedArticleFeeds(ctx context.Context, pool *pgxpool.Pool, feeds []SeedArticleFeed) error {
	for _, f := range feeds {
		_, err := pool.Exec(ctx, `
			INSERT INTO article_feed (rss_url, source_name, lang, sport)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (rss_url) DO NOTHING`,
			f.RSSURL, f.SourceName, f.Lang, nullIfEmpty(f.Sport))
		if err != nil {
			return fmt.Errorf("seed article feed %s: %w", f.RSSURL, err)
		}
	}
	return nil
}

func LoadArticleFeeds(ctx context.Context, pool *pgxpool.Pool) ([]models.ArticleFeed, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, rss_url, source_name, lang, sport, etag, last_modified
		FROM article_feed
		ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("query article feeds: %w", err)
	}
	defer rows.Close()

	var feeds []models.ArticleFeed
	for rows.Next() {
		var f models.ArticleFeed
		if err := rows.Scan(&f.ID, &f.RSSURL, &f.SourceName, &f.Lang, &f.Sport, &f.ETag, &f.LastModified); err != nil {
			return nil, fmt.Errorf("scan article feed: %w", err)
		}
		feeds = append(feeds, f)
	}
	return feeds, rows.Err()
}

type ArticleResult struct {
	FeedID           int64
	NotModified      bool
	ArticlesUpserted int
}

// IngestArticleFeed fetch+parse un flux d'articles et upsert les items
// récents — pas de segmentation ni de téléchargement de contenu séparé (à la
// différence des podcasts) : le titre + résumé du flux RSS EST le contenu.
func IngestArticleFeed(ctx context.Context, pool *pgxpool.Pool, feed models.ArticleFeed, rankSet frequency.RankSet) (ArticleResult, error) {
	res := ArticleResult{FeedID: feed.ID}

	prevETag := ""
	if feed.ETag != nil {
		prevETag = *feed.ETag
	}
	prevLastModified := ""
	if feed.LastModified != nil {
		prevLastModified = *feed.LastModified
	}

	fetched, err := rssfeed.FetchFeed(ctx, feed.RSSURL, prevETag, prevLastModified)
	if err != nil {
		return res, fmt.Errorf("fetch article feed: %w", err)
	}

	if _, err := pool.Exec(ctx, `UPDATE article_feed SET last_fetched_at = now() WHERE id = $1`, feed.ID); err != nil {
		return res, fmt.Errorf("touch last_fetched_at: %w", err)
	}

	if fetched.NotModified {
		res.NotModified = true
		return res, nil
	}

	parsed, err := rssfeed.Parse(fetched.Body)
	if err != nil {
		return res, fmt.Errorf("parse article feed: %w", err)
	}

	if _, err := pool.Exec(ctx, `UPDATE article_feed SET etag = $1, last_modified = $2 WHERE id = $3`,
		nullIfEmpty(fetched.ETag), nullIfEmpty(fetched.LastModified), feed.ID); err != nil {
		return res, fmt.Errorf("update article feed cache headers: %w", err)
	}

	items := parsed.Channel.Items
	if len(items) > maxArticlesPerFeed {
		items = items[:maxArticlesPerFeed]
	}

	for _, item := range items {
		guid := item.GUID
		if guid == "" {
			guid = item.Link
		}
		if guid == "" || item.Link == "" {
			continue // rien d'identifiable/lisible à garder
		}

		var publishedAt *string
		if t, ok := rssfeed.ParsePubDate(item.PubDate); ok {
			s := t.Format("2006-01-02T15:04:05Z07:00")
			publishedAt = &s
		}

		summary := stripHTML(item.Description)

		// rare_ratio n'a de sens que dans une langue cible : on n'a pas de
		// liste de fréquence française, et un rankSet vide donnerait 1.0
		// partout — un score faussement alarmant plutôt qu'une absence de
		// score. On laisse donc NULL pour les flux en français.
		var rareRatio *float64
		if len(rankSet) > 0 {
			r := frequency.RareRatio(item.Title+" "+summary, rankSet)
			rareRatio = &r
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO article (feed_id, guid, title, summary, url, published_at, rare_ratio)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (feed_id, guid) DO UPDATE SET
				title = EXCLUDED.title,
				summary = EXCLUDED.summary,
				url = EXCLUDED.url,
				published_at = EXCLUDED.published_at,
				rare_ratio = EXCLUDED.rare_ratio`,
			feed.ID, guid, item.Title, summary, item.Link, publishedAt, rareRatio,
		)
		if err != nil {
			return res, fmt.Errorf("upsert article %q: %w", guid, err)
		}
		res.ArticlesUpserted++
	}

	return res, nil
}

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

// stripHTML retire les balises HTML que certains flux glissent dans
// <description> (liens, gras...) — le XML lui-même est déjà décodé par
// encoding/xml, il ne reste que du HTML imbriqué à nettoyer.
func stripHTML(s string) string {
	return strings.TrimSpace(htmlTagRe.ReplaceAllString(s, ""))
}
