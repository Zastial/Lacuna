// Package apihttp expose l'API JSON en lecture (§8 Phase 1) : GET /feeds,
// GET /episodes?lang=&level=, GET /episodes/:id/segments.
package apihttp

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewMux(pool *pgxpool.Pool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /feeds", listFeeds(pool))
	mux.HandleFunc("GET /episodes", listEpisodes(pool))
	mux.HandleFunc("GET /episodes/{id}/segments", episodeSegments(pool))
	mux.HandleFunc("GET /articles", listArticles(pool))
	mux.HandleFunc("GET /videos", listVideos(pool))
	mux.HandleFunc("POST /sync/captures", syncCaptures(pool))
	mux.HandleFunc("POST /sync/review_state", syncReviewState(pool))
	mux.HandleFunc("GET /sync/state", syncState(pool))
	mux.HandleFunc("GET /healthz", healthz(pool))
	return withCORS(mux)
}

// withCORS autorise les appels cross-origin depuis l'app mobile (WKWebView
// sert le contenu depuis capacitor://localhost ou http://localhost, une
// origine différente de celle de l'API) — client unique, aucune donnée
// sensible exposée, une autorisation large est donc sans risque ici.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
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

type articleJSON struct {
	ID          int64    `json:"id"`
	SourceName  string   `json:"source_name"`
	Lang        string   `json:"lang"`
	Sport       *string  `json:"sport"`
	Title       string   `json:"title"`
	Summary     string   `json:"summary"`
	URL         string   `json:"url"`
	PublishedAt *string  `json:"published_at"`
	RareRatio   *float64 `json:"rare_ratio"`
}

const defaultArticleLimit = 20
const maxArticleLimit = 50

// listArticles filtre par lang (§ mode Articles : "chaque jour, quelques
// articles récents") et renvoie les plus récents tous flux confondus pour
// cette langue, limité par `limit` (défaut 20, plafond 50).
func listArticles(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lang := r.URL.Query().Get("lang")
		// `sports` accepte une liste séparée par des virgules : l'app envoie
		// les préférences de l'utilisateur d'un coup plutôt qu'un appel par
		// sport.
		sports := []string{}
		if raw := r.URL.Query().Get("sports"); raw != "" {
			for _, s := range strings.Split(raw, ",") {
				if s = strings.TrimSpace(s); s != "" {
					sports = append(sports, s)
				}
			}
		}

		limit := defaultArticleLimit
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 {
				limit = n
			}
		}
		if limit > maxArticleLimit {
			limit = maxArticleLimit
		}

		rows, err := pool.Query(r.Context(), `
			SELECT a.id, f.source_name, f.lang, f.sport, a.title, a.summary, a.url, a.published_at, a.rare_ratio
			FROM article a
			JOIN article_feed f ON f.id = a.feed_id
			WHERE ($1 = '' OR f.lang = $1)
			  AND (cardinality($2::text[]) = 0 OR f.sport = ANY($2::text[]))
			ORDER BY a.published_at DESC NULLS LAST, a.id DESC
			LIMIT $3`,
			lang, sports, limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		defer rows.Close()

		articles := []articleJSON{}
		for rows.Next() {
			var a articleJSON
			var publishedAt *time.Time
			if err := rows.Scan(&a.ID, &a.SourceName, &a.Lang, &a.Sport, &a.Title, &a.Summary, &a.URL, &publishedAt, &a.RareRatio); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			a.PublishedAt = formatTime(publishedAt)
			articles = append(articles, a)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, articles)
	}
}

type videoJSON struct {
	ID           int64   `json:"id"`
	YouTubeID    string  `json:"youtube_id"`
	ChannelName  string  `json:"channel_name"`
	Lang         string  `json:"lang"`
	Category     string  `json:"category"`
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	ThumbnailURL string  `json:"thumbnail_url"`
	PublishedAt  *string `json:"published_at"`
}

const defaultVideoLimit = 20
const maxVideoLimit = 60

// listVideos filtre par langue et par centres d'intérêt. `categories` accepte
// une liste séparée par des virgules : l'app envoie d'un coup ce que
// l'utilisateur a choisi à l'onboarding.
func listVideos(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lang := r.URL.Query().Get("lang")

		categories := []string{}
		if raw := r.URL.Query().Get("categories"); raw != "" {
			for _, c := range strings.Split(raw, ",") {
				if c = strings.TrimSpace(c); c != "" {
					categories = append(categories, c)
				}
			}
		}

		limit := defaultVideoLimit
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 {
				limit = n
			}
		}
		if limit > maxVideoLimit {
			limit = maxVideoLimit
		}

		rows, err := pool.Query(r.Context(), `
			SELECT v.id, v.youtube_video_id, c.name, c.lang, c.category,
			       v.title, v.description, v.thumbnail_url, v.published_at
			FROM video v
			JOIN video_channel c ON c.id = v.channel_id
			WHERE ($1 = '' OR c.lang = $1)
			  AND (cardinality($2::text[]) = 0 OR c.category = ANY($2::text[]))
			ORDER BY v.published_at DESC NULLS LAST, v.id DESC
			LIMIT $3`,
			lang, categories, limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		defer rows.Close()

		videos := []videoJSON{}
		for rows.Next() {
			var v videoJSON
			var publishedAt *time.Time
			if err := rows.Scan(&v.ID, &v.YouTubeID, &v.ChannelName, &v.Lang, &v.Category,
				&v.Title, &v.Description, &v.ThumbnailURL, &publishedAt); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			v.PublishedAt = formatTime(publishedAt)
			videos = append(videos, v)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, videos)
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
