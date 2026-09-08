package apihttp

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Sauvegarde serveur des données utilisateur (§6.4) : pull only côté
// contenu, push périodique côté capture/review_state, le serveur ne modifie
// jamais ces lignes de lui-même — client unique, pas de résolution de
// conflits à construire.

type captureSyncJSON struct {
	ID         string  `json:"id"`
	SegmentID  int64   `json:"segment_id"`
	EpisodeID  int64   `json:"episode_id"`
	CapturedAt int64   `json:"captured_at"` // epoch ms, comme côté client
	Kind       string  `json:"kind"`
	Note       *string `json:"note"`
}

type reviewStateSyncJSON struct {
	SegmentID  int64   `json:"segment_id"`
	DueAt      int64   `json:"due_at"` // epoch ms
	Stability  float64 `json:"stability"`
	Difficulty float64 `json:"difficulty"`
	Reps       int     `json:"reps"`
	Lapses     int     `json:"lapses"`
	LastGrade  *int    `json:"last_grade"`
	LastReview *int64  `json:"last_review"` // epoch ms
}

func syncCaptures(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var items []captureSyncJSON
		if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		batch := &pgx.Batch{}
		for _, c := range items {
			batch.Queue(`
				INSERT INTO capture (id, segment_id, episode_id, captured_at, kind, note)
				VALUES ($1, $2, $3, $4, $5, $6)
				ON CONFLICT (id) DO NOTHING`,
				c.ID, c.SegmentID, c.EpisodeID, msToTime(c.CapturedAt), c.Kind, c.Note)
		}

		if err := execBatch(r, pool, batch, len(items)); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func syncReviewState(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var items []reviewStateSyncJSON
		if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		batch := &pgx.Batch{}
		for _, s := range items {
			var lastReview *time.Time
			if s.LastReview != nil {
				t := msToTime(*s.LastReview)
				lastReview = &t
			}
			batch.Queue(`
				INSERT INTO review_state (segment_id, due_at, stability, difficulty, reps, lapses, last_grade, last_review, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
				ON CONFLICT (segment_id) DO UPDATE SET
					due_at = excluded.due_at, stability = excluded.stability, difficulty = excluded.difficulty,
					reps = excluded.reps, lapses = excluded.lapses, last_grade = excluded.last_grade,
					last_review = excluded.last_review, updated_at = now()`,
				s.SegmentID, msToTime(s.DueAt), s.Stability, s.Difficulty, s.Reps, s.Lapses, s.LastGrade, lastReview)
		}

		if err := execBatch(r, pool, batch, len(items)); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// syncState renvoie tout l'historique capture/review_state — utilisé pour
// restaurer après une réinstallation (§3.1 : le conteneur sandbox est perdu
// à chaque redéploiement Xcode).
func syncState(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		captures, err := fetchCaptures(r, pool)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		states, err := fetchReviewStates(r, pool)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"captures":     captures,
			"review_state": states,
		})
	}
}

func fetchCaptures(r *http.Request, pool *pgxpool.Pool) ([]captureSyncJSON, error) {
	rows, err := pool.Query(r.Context(), `SELECT id, segment_id, episode_id, captured_at, kind, note FROM capture`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []captureSyncJSON{}
	for rows.Next() {
		var c captureSyncJSON
		var capturedAt time.Time
		if err := rows.Scan(&c.ID, &c.SegmentID, &c.EpisodeID, &capturedAt, &c.Kind, &c.Note); err != nil {
			return nil, err
		}
		c.CapturedAt = capturedAt.UnixMilli()
		out = append(out, c)
	}
	return out, rows.Err()
}

func fetchReviewStates(r *http.Request, pool *pgxpool.Pool) ([]reviewStateSyncJSON, error) {
	rows, err := pool.Query(r.Context(), `
		SELECT segment_id, due_at, stability, difficulty, reps, lapses, last_grade, last_review FROM review_state`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []reviewStateSyncJSON{}
	for rows.Next() {
		var s reviewStateSyncJSON
		var dueAt time.Time
		var lastReview *time.Time
		if err := rows.Scan(&s.SegmentID, &dueAt, &s.Stability, &s.Difficulty, &s.Reps, &s.Lapses, &s.LastGrade, &lastReview); err != nil {
			return nil, err
		}
		s.DueAt = dueAt.UnixMilli()
		if lastReview != nil {
			ms := lastReview.UnixMilli()
			s.LastReview = &ms
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func execBatch(r *http.Request, pool *pgxpool.Pool, batch *pgx.Batch, n int) error {
	if n == 0 {
		return nil
	}
	br := pool.SendBatch(r.Context(), batch)
	defer br.Close()
	for i := 0; i < n; i++ {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func msToTime(ms int64) time.Time {
	return time.UnixMilli(ms)
}
