// Package ingest orchestre un cycle d'ingestion complet pour un flux :
// fetch RSS (cache conditionnel), upsert des épisodes, téléchargement et
// découpage du transcript en segments, calcul de rare_ratio.
package ingest

import (
	"bytes"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lacuna/internal/frequency"
	"lacuna/internal/models"
	"lacuna/internal/rssfeed"
	"lacuna/internal/transcript"
)

// maxItemsPerFeed borne le nombre d'épisodes traités par passage, pour ne
// pas importer tout l'historique dès le premier run sur un flux à 500
// épisodes. Les passages suivants reprennent les mêmes items récents (upsert
// idempotent) et progressent au fil des publications.
const maxItemsPerFeed = 20

type SeedFeed struct {
	RSSURL string
	Title  string
	Lang   string
	Level  string
}

// SeedFeeds insère les flux connus dans la table feed s'ils n'y sont pas
// déjà (ON CONFLICT DO NOTHING : ne jamais écraser un etag/last_fetched_at
// déjà en base).
func SeedFeeds(ctx context.Context, pool *pgxpool.Pool, feeds []SeedFeed) error {
	for _, f := range feeds {
		_, err := pool.Exec(ctx, `
			INSERT INTO feed (rss_url, title, lang, level)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (rss_url) DO NOTHING`,
			f.RSSURL, f.Title, f.Lang, f.Level)
		if err != nil {
			return fmt.Errorf("seed feed %s: %w", f.RSSURL, err)
		}
	}
	return nil
}

// LoadFeeds renvoie tous les flux enregistrés.
func LoadFeeds(ctx context.Context, pool *pgxpool.Pool) ([]models.Feed, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, rss_url, title, lang, level, has_transcripts, etag, last_modified
		FROM feed
		ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("query feeds: %w", err)
	}
	defer rows.Close()

	var feeds []models.Feed
	for rows.Next() {
		var f models.Feed
		if err := rows.Scan(&f.ID, &f.RSSURL, &f.Title, &f.Lang, &f.Level, &f.HasTranscripts, &f.ETag, &f.LastModified); err != nil {
			return nil, fmt.Errorf("scan feed: %w", err)
		}
		feeds = append(feeds, f)
	}
	return feeds, rows.Err()
}

// Result résume ce qu'un passage d'ingestion a fait pour un flux.
type Result struct {
	FeedID            int64
	NotModified       bool
	EpisodesUpserted  int
	EpisodesSegmented int
	SegmentsInserted  int
}

// IngestFeed exécute un cycle complet pour un flux : fetch conditionnel,
// upsert des épisodes récents, et pour ceux qui n'ont pas encore de segments
// et exposent un transcript exploitable, télécharge/découpe/note la
// difficulté avant d'insérer les segments.
func IngestFeed(ctx context.Context, pool *pgxpool.Pool, feed models.Feed, rankSet frequency.RankSet) (Result, error) {
	res := Result{FeedID: feed.ID}

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
		return res, fmt.Errorf("fetch feed: %w", err)
	}

	if _, err := pool.Exec(ctx, `UPDATE feed SET last_fetched_at = now() WHERE id = $1`, feed.ID); err != nil {
		return res, fmt.Errorf("touch last_fetched_at: %w", err)
	}

	if fetched.NotModified {
		res.NotModified = true
		return res, nil
	}

	parsed, err := rssfeed.Parse(fetched.Body)
	if err != nil {
		return res, fmt.Errorf("parse feed: %w", err)
	}

	if _, err := pool.Exec(ctx, `UPDATE feed SET etag = $1, last_modified = $2 WHERE id = $3`,
		nullIfEmpty(fetched.ETag), nullIfEmpty(fetched.LastModified), feed.ID); err != nil {
		return res, fmt.Errorf("update feed cache headers: %w", err)
	}

	items := parsed.Channel.Items
	if len(items) > maxItemsPerFeed {
		items = items[:maxItemsPerFeed]
	}

	anySegmented := false
	for _, item := range items {
		episodeID, segmentsReady, err := upsertEpisode(ctx, pool, feed.ID, item)
		if err != nil {
			return res, fmt.Errorf("upsert episode %q: %w", item.GUID, err)
		}
		res.EpisodesUpserted++

		if segmentsReady {
			anySegmented = true // déjà traité lors d'un passage précédent
			continue
		}

		tr, format, ok := rssfeed.SelectTranscript(item.Transcripts)
		if !ok {
			continue
		}

		n, err := segmentEpisode(ctx, pool, episodeID, tr.URL, format, rankSet)
		if err != nil {
			// Un transcript inexploitable sur UN épisode ne doit pas faire
			// échouer tout le flux : on log-équivalent (retourné à l'appelant
			// via l'erreur enveloppée) et on continue les autres épisodes.
			return res, fmt.Errorf("segment episode %q: %w", item.GUID, err)
		}
		if n > 0 {
			res.SegmentsInserted += n
			res.EpisodesSegmented++
			anySegmented = true
		}
	}

	if anySegmented {
		if _, err := pool.Exec(ctx, `UPDATE feed SET has_transcripts = TRUE WHERE id = $1`, feed.ID); err != nil {
			return res, fmt.Errorf("mark feed has_transcripts: %w", err)
		}
	}

	return res, nil
}

// upsertEpisode insère ou met à jour les métadonnées d'un épisode, sans
// jamais réinitialiser segments_ready (colonne absente du SET => valeur
// existante conservée par Postgres).
func upsertEpisode(ctx context.Context, pool *pgxpool.Pool, feedID int64, item rssfeed.Item) (id int64, segmentsReady bool, err error) {
	var durationS *int
	if d := rssfeed.ParseItunesDuration(item.Duration); d > 0 {
		s := int(d.Seconds())
		durationS = &s
	}

	var publishedAt *string
	if t, ok := rssfeed.ParsePubDate(item.PubDate); ok {
		s := t.Format("2006-01-02T15:04:05Z07:00")
		publishedAt = &s
	}

	var transcriptURL, transcriptType *string
	if tr, format, ok := rssfeed.SelectTranscript(item.Transcripts); ok {
		transcriptURL = &tr.URL
		transcriptType = &format
	}

	err = pool.QueryRow(ctx, `
		INSERT INTO episode (feed_id, guid, title, audio_url, duration_s, published_at, transcript_url, transcript_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (feed_id, guid) DO UPDATE SET
			title = EXCLUDED.title,
			audio_url = EXCLUDED.audio_url,
			duration_s = EXCLUDED.duration_s,
			published_at = EXCLUDED.published_at,
			transcript_url = EXCLUDED.transcript_url,
			transcript_type = EXCLUDED.transcript_type
		RETURNING id, segments_ready`,
		feedID, item.GUID, item.Title, item.Enclosure.URL, durationS, publishedAt, transcriptURL, transcriptType,
	).Scan(&id, &segmentsReady)

	return id, segmentsReady, err
}

// segmentEpisode télécharge le transcript, le parse, fusionne les cues en
// segments de révision, calcule rare_ratio et insère le tout en une seule
// transaction. Renvoie le nombre de segments insérés.
func segmentEpisode(ctx context.Context, pool *pgxpool.Pool, episodeID int64, transcriptURL, format string, rankSet frequency.RankSet) (int, error) {
	body, err := rssfeed.FetchURL(ctx, transcriptURL)
	if err != nil {
		return 0, fmt.Errorf("fetch transcript: %w", err)
	}

	var cues []transcript.Cue
	if format == "vtt" {
		cues, err = transcript.ParseVTT(bytes.NewReader(body))
	} else {
		cues, err = transcript.ParseSRT(bytes.NewReader(body))
	}
	if err != nil {
		return 0, fmt.Errorf("parse transcript: %w", err)
	}

	segments := transcript.MergeCues(cues, transcript.DefaultMergeOptions())
	if len(segments) == 0 {
		return 0, nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op si déjà commit

	batch := &pgx.Batch{}
	for idx, seg := range segments {
		wordCount := len(frequency.Tokenize(seg.Text))
		rareRatio := frequency.RareRatio(seg.Text, rankSet)
		batch.Queue(`
			INSERT INTO segment (episode_id, idx, start_ms, end_ms, text, word_count, rare_ratio)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (episode_id, idx) DO UPDATE SET
				start_ms = EXCLUDED.start_ms, end_ms = EXCLUDED.end_ms,
				text = EXCLUDED.text, word_count = EXCLUDED.word_count, rare_ratio = EXCLUDED.rare_ratio`,
			episodeID, idx, int(seg.Start.Milliseconds()), int(seg.End.Milliseconds()), seg.Text, wordCount, rareRatio,
		)
	}

	br := tx.SendBatch(ctx, batch)
	for range segments {
		if _, err := br.Exec(); err != nil {
			br.Close()
			return 0, fmt.Errorf("insert segment: %w", err)
		}
	}
	if err := br.Close(); err != nil {
		return 0, fmt.Errorf("close batch: %w", err)
	}

	if _, err := tx.Exec(ctx, `UPDATE episode SET segments_ready = TRUE WHERE id = $1`, episodeID); err != nil {
		return 0, fmt.Errorf("mark segments_ready: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit tx: %w", err)
	}

	return len(segments), nil
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
