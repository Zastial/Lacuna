// Package apihttp expose l'API JSON en lecture : GET /videos et GET
// /articles, tous deux filtrables par langue et par centre d'intérêt.
package apihttp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"lacuna/internal/ai"
)

func NewMux(pool *pgxpool.Pool, ai *ai.Client) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /correct", correct(ai))
	mux.HandleFunc("GET /correct/status", correctStatus(ai))
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
	Views        int64   `json:"views"`
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

		// Deux règles de tri, chacune corrigeant un défaut constaté.
		//
		// 1. Alternance par chaîne. Trié à plat, la chaîne la plus prolifique
		//    remplissait l'écran — MARCA occupait 15 des 24 places, et cocher
		//    un centre d'intérêt de plus ne changeait qu'une ligne enfouie.
		//
		// 2. Popularité plutôt que date, à l'intérieur de chaque chaîne. Le
		//    flux Atom ne contient que les 15 dernières vidéos : trier par
		//    vues dans ce vivier revient à proposer le meilleur de ce qui est
		//    récent, pas le dernier téléversement quel qu'il soit. Mesuré,
		//    l'écart entre chaînes va de 1 300 vues médianes à 276 000 — sans
		//    ce tri, les deux occupaient la même place.
		rows, err := pool.Query(r.Context(), `
			SELECT id, youtube_video_id, views, name, lang, category,
			       title, description, thumbnail_url, published_at
			FROM (
				SELECT v.id, v.youtube_video_id, v.views, c.name, c.lang, c.category,
				       v.title, v.description, v.thumbnail_url, v.published_at,
				       row_number() OVER (
				           PARTITION BY v.channel_id
				           ORDER BY v.views DESC, v.likes DESC, v.id DESC
				       ) AS rang
				FROM video v
				JOIN video_channel c ON c.id = v.channel_id
				WHERE (cardinality($1::text[]) = 0 OR c.lang = ANY($1::text[]))
				  AND (cardinality($2::text[]) = 0 OR c.category = ANY($2::text[]))
			) t
			ORDER BY rang, views DESC, id DESC
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
			if err := rows.Scan(&v.ID, &v.YouTubeID, &v.Views, &v.ChannelName, &v.Lang, &v.Category,
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

type correctRequest struct {
	Lang       string `json:"lang"`
	Expected   string `json:"expected"`
	ExpectedFr string `json:"expected_fr"`
	Said       string `json:"said"`
}

// correctStatus permet à l'app de savoir si la correction est disponible
// avant de proposer un bouton. Sans clé côté serveur, mieux vaut masquer la
// fonctionnalité que laisser l'utilisateur buter dessus.
func correctStatus(client *ai.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"enabled": client.Enabled()})
	}
}

func correct(client *ai.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req correctRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		if !client.Enabled() {
			writeError(w, http.StatusServiceUnavailable, fmt.Errorf("correction non configurée"))
			return
		}

		result, err := client.Correct(r.Context(), req.Lang, req.Expected, req.ExpectedFr, req.Said)
		if err != nil {
			// 502 et non 500 : l'échec vient du service en amont, souvent une
			// limite de débit du palier gratuit. La distinction permet à
			// l'app de proposer un nouvel essai plutôt qu'un message fatal.
			writeError(w, http.StatusBadGateway, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
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
