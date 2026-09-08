package ingest

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"lacuna/internal/models"
	"lacuna/internal/rssfeed"
)

// SeedVideoChannel décrit une chaîne à suivre, telle que codée en dur dans
// cmd/ingester : identifiant YouTube, langue, centre d'intérêt.
type SeedVideoChannel struct {
	YouTubeChannelID string
	Name             string
	Lang             string
	Category         string
}

func SeedVideoChannels(ctx context.Context, pool *pgxpool.Pool, channels []SeedVideoChannel) error {
	for _, c := range channels {
		_, err := pool.Exec(ctx, `
			INSERT INTO video_channel (youtube_channel_id, name, lang, category)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (youtube_channel_id) DO UPDATE SET
				name = excluded.name, lang = excluded.lang, category = excluded.category`,
			c.YouTubeChannelID, c.Name, c.Lang, c.Category)
		if err != nil {
			return fmt.Errorf("seed video channel %s: %w", c.Name, err)
		}
	}
	return nil
}

func LoadVideoChannels(ctx context.Context, pool *pgxpool.Pool) ([]models.VideoChannel, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, youtube_channel_id, name, lang, category, etag, last_modified, last_fetched_at
		FROM video_channel ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("load video channels: %w", err)
	}
	defer rows.Close()

	var channels []models.VideoChannel
	for rows.Next() {
		var c models.VideoChannel
		if err := rows.Scan(&c.ID, &c.YouTubeChannelID, &c.Name, &c.Lang, &c.Category,
			&c.ETag, &c.LastModified, &c.LastFetchedAt); err != nil {
			return nil, fmt.Errorf("scan video channel: %w", err)
		}
		channels = append(channels, c)
	}
	return channels, rows.Err()
}

type VideoResult struct {
	ChannelName string
	Fetched     int
	Inserted    int
	NotModified bool
}

// IngestVideoChannel récupère le flux Atom d'une chaîne et enregistre ses
// vidéos. Aucune clé d'API n'entre en jeu : le flux public suffit, et le
// cache conditionnel évite de retélécharger un flux inchangé.
func IngestVideoChannel(ctx context.Context, pool *pgxpool.Pool, channel models.VideoChannel) (VideoResult, error) {
	result := VideoResult{ChannelName: channel.Name}

	prevETag, prevModified := "", ""
	if channel.ETag != nil {
		prevETag = *channel.ETag
	}
	if channel.LastModified != nil {
		prevModified = *channel.LastModified
	}

	fetch, err := rssfeed.FetchFeed(ctx, rssfeed.ChannelFeedURL(channel.YouTubeChannelID),
		prevETag, prevModified)
	if err != nil {
		return result, fmt.Errorf("fetch channel %s: %w", channel.Name, err)
	}
	if fetch.NotModified {
		result.NotModified = true
		return result, nil
	}

	feed, err := rssfeed.ParseYouTube(fetch.Body)
	if err != nil {
		return result, fmt.Errorf("parse channel %s: %w", channel.Name, err)
	}
	result.Fetched = len(feed.Entries)

	for _, entry := range feed.Entries {
		if entry.VideoID == "" {
			continue
		}
		var publishedAt *time.Time
		if t, err := time.Parse(time.RFC3339, entry.Published); err == nil {
			publishedAt = &t
		}

		title := entry.Title
		if title == "" {
			title = entry.Group.Title
		}

		tag, err := pool.Exec(ctx, `
			INSERT INTO video (channel_id, youtube_video_id, title, description, thumbnail_url, published_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (channel_id, youtube_video_id) DO UPDATE SET
				title = excluded.title, description = excluded.description,
				thumbnail_url = excluded.thumbnail_url, published_at = excluded.published_at`,
			channel.ID, entry.VideoID, title, entry.Group.Description,
			entry.Group.Thumbnail.URL, publishedAt)
		if err != nil {
			return result, fmt.Errorf("insert video %s: %w", entry.VideoID, err)
		}
		result.Inserted += int(tag.RowsAffected())
	}

	_, err = pool.Exec(ctx, `
		UPDATE video_channel SET etag = $2, last_modified = $3, last_fetched_at = now() WHERE id = $1`,
		channel.ID, nullIfEmpty(fetch.ETag), nullIfEmpty(fetch.LastModified))
	if err != nil {
		return result, fmt.Errorf("update channel cache %s: %w", channel.Name, err)
	}
	return result, nil
}
