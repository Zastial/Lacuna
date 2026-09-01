// Package apihttp expose l'API JSON en lecture (§8 Phase 1) : GET /feeds,
// GET /episodes?lang=&level=, GET /episodes/:id/segments.
package apihttp

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewMux(pool *pgxpool.Pool) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /feeds", listFeeds(pool))
	mux.HandleFunc("GET /episodes", listEpisodes(pool))
	mux.HandleFunc("GET /episodes/{id}/segments", episodeSegments(pool))
	mux.HandleFunc("GET /healthz", healthz(pool))
	return mux
}

type feedJSON struct {
	ID             int64  `json:"id"`
	RSSURL         string `json:"rss_url"`
	Title          string `json:"title"`
	Lang           string `json:"lang"`
	Level          string `json:"level"`
	HasTranscripts bool   `json:"has_transcripts"`
}

func listFeeds(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
			SELECT id, rss_url, title, lang, level, has_transcripts FROM feed ORDER BY id`)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		defer rows.Close()

		feeds := []feedJSON{}
		for rows.Next() {
			var f feedJSON
			if err := rows.Scan(&f.ID, &f.RSSURL, &f.Title, &f.Lang, &f.Level, &f.HasTranscripts); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			feeds = append(feeds, f)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, feeds)
	}
}

type episodeJSON struct {
	ID            int64   `json:"id"`
	FeedID        int64   `json:"feed_id"`
	Title         string  `json:"title"`
	AudioURL      string  `json:"audio_url"`
	DurationS     *int    `json:"duration_s"`
	PublishedAt   *string `json:"published_at"`
	SegmentsReady bool    `json:"segments_ready"`
}

// listEpisodes filtre par lang/level (query params optionnels, se
// rapportent aux colonnes du flux parent — §8 : "GET /episodes?lang=es").
func listEpisodes(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lang := r.URL.Query().Get("lang")
		level := r.URL.Query().Get("level")

		rows, err := pool.Query(r.Context(), `
			SELECT e.id, e.feed_id, e.title, e.audio_url, e.duration_s, e.published_at, e.segments_ready
			FROM episode e
			JOIN feed f ON f.id = e.feed_id
			WHERE ($1 = '' OR f.lang = $1)
			  AND ($2 = '' OR f.level = $2)
			ORDER BY e.published_at DESC NULLS LAST, e.id DESC`,
			lang, level)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		defer rows.Close()

		episodes := []episodeJSON{}
		for rows.Next() {
			var e episodeJSON
			var publishedAt *time.Time
			if err := rows.Scan(&e.ID, &e.FeedID, &e.Title, &e.AudioURL, &e.DurationS, &publishedAt, &e.SegmentsReady); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			e.PublishedAt = formatTime(publishedAt)
			episodes = append(episodes, e)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, episodes)
	}
}

type segmentJSON struct {
	Idx       int      `json:"idx"`
	StartMS   int      `json:"start_ms"`
	EndMS     int      `json:"end_ms"`
	Text      string   `json:"text"`
	WordCount int      `json:"word_count"`
	RareRatio *float64 `json:"rare_ratio"`
}

type episodeSegmentsJSON struct {
	Episode  episodeJSON   `json:"episode"`
	Segments []segmentJSON `json:"segments"`
}

func episodeSegments(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		var episode episodeJSON
		var publishedAt *time.Time
		err = pool.QueryRow(r.Context(), `
			SELECT id, feed_id, title, audio_url, duration_s, published_at, segments_ready
			FROM episode WHERE id = $1`, id,
		).Scan(&episode.ID, &episode.FeedID, &episode.Title, &episode.AudioURL, &episode.DurationS, &publishedAt, &episode.SegmentsReady)
		if err != nil {
			writeError(w, http.StatusNotFound, err)
			return
		}
		episode.PublishedAt = formatTime(publishedAt)

		rows, err := pool.Query(r.Context(), `
			SELECT idx, start_ms, end_ms, text, word_count, rare_ratio
			FROM segment WHERE episode_id = $1 ORDER BY idx`, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		defer rows.Close()

		segments := []segmentJSON{}
		for rows.Next() {
			var s segmentJSON
			if err := rows.Scan(&s.Idx, &s.StartMS, &s.EndMS, &s.Text, &s.WordCount, &s.RareRatio); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			segments = append(segments, s)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}

		writeJSON(w, http.StatusOK, episodeSegmentsJSON{Episode: episode, Segments: segments})
	}
}

func healthz(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := pool.Ping(context.Background()); err != nil {
			writeError(w, http.StatusServiceUnavailable, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func formatTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
