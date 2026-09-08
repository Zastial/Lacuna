// Package apihttp expose l'API JSON en lecture : GET /videos et GET
// /articles, tous deux filtrables par langue et par centre d'intérêt.
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
	mux.HandleFunc("GET /articles", listArticles(pool))
	mux.HandleFunc("GET /videos", listVideos(pool))
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

// csvParam lit un paramètre de requête en liste séparée par des virgules.
// Une liste vide vaut « pas de filtre » côté SQL : c'est ce qui permet à
// l'app d'envoyer les choix de l'utilisateur d'un seul coup, y compris
// quand il n'a rien restreint.
func csvParam(r *http.Request, name string) []string {
	out := []string{}
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return out
	}
	for _, v := range strings.Split(raw, ",") {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
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
		langs := csvParam(r, "langs")
		sports := csvParam(r, "sports")

		limit := defaultArticleLimit
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 {
				limit = n
			}
		}
		if limit > maxArticleLimit {
			limit = maxArticleLimit
		}

		// Même alternance que pour les vidéos : trié par date seule, la
		// rubrique la plus active occupait toute la sélection du jour et
		// cocher un sport de plus ne se voyait pas.
		rows, err := pool.Query(r.Context(), `
			SELECT id, source_name, lang, sport, title, summary, url, published_at, rare_ratio
			FROM (
				SELECT a.id, f.source_name, f.lang, f.sport, a.title, a.summary,
				       a.url, a.published_at, a.rare_ratio,
				       row_number() OVER (
				           PARTITION BY a.feed_id
				           ORDER BY a.published_at DESC NULLS LAST, a.id DESC
				       ) AS rang
				FROM article a
				JOIN article_feed f ON f.id = a.feed_id
				WHERE (cardinality($1::text[]) = 0 OR f.lang = ANY($1::text[]))
				  AND (cardinality($2::text[]) = 0 OR f.sport = ANY($2::text[]))
			) t
			ORDER BY rang, published_at DESC NULLS LAST, id DESC
			LIMIT $3`,
			langs, sports, limit)
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
		langs := csvParam(r, "langs")
		categories := csvParam(r, "categories")

		limit := defaultVideoLimit
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 {
				limit = n
			}
		}
		if limit > maxVideoLimit {
			limit = maxVideoLimit
		}

		// Alternance par chaîne plutôt que tri par date seule. Une chaîne
		// prolifique monopolisait sinon le haut de la liste — MARCA
		// occupait 15 des 24 places, et cocher un centre d'intérêt de plus
		// ne changeait qu'une ligne enfouie en bas : le réglage donnait
		// l'impression de ne rien faire.
		//
		// row_number() classe les vidéos à l'intérieur de chaque chaîne, puis
		// on trie par ce rang : la plus récente de chaque chaîne d'abord,
		// ensuite la deuxième de chacune, et ainsi de suite. Chaque centre
		// d'intérêt coché est donc visible dès les premières lignes.
		rows, err := pool.Query(r.Context(), `
			SELECT id, youtube_video_id, name, lang, category,
			       title, description, thumbnail_url, published_at
			FROM (
				SELECT v.id, v.youtube_video_id, c.name, c.lang, c.category,
				       v.title, v.description, v.thumbnail_url, v.published_at,
				       row_number() OVER (
				           PARTITION BY v.channel_id
				           ORDER BY v.published_at DESC NULLS LAST, v.id DESC
				       ) AS rang
				FROM video v
				JOIN video_channel c ON c.id = v.channel_id
				WHERE (cardinality($1::text[]) = 0 OR c.lang = ANY($1::text[]))
				  AND (cardinality($2::text[]) = 0 OR c.category = ANY($2::text[]))
			) t
			ORDER BY rang, published_at DESC NULLS LAST, id DESC
			LIMIT $3`,
			langs, categories, limit)
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
