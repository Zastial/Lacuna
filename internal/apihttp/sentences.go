package apihttp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"lacuna/internal/ai"
)

type sentencesRequest struct {
	Lang  string            `json:"lang"`
	Lemma string            `json:"lemma"`
	Tense string            `json:"tense"`
	Forms []ai.SentenceForm `json:"forms"`
}

type sentencesResponse struct {
	Sentences []ai.Sentence `json:"sentences"`
	// Generated dit si l'appel a coûté du quota. L'app n'en fait rien, mais
	// le champ rend le comportement du cache observable au débogage.
	Generated bool `json:"generated"`
}

// sentences rend une phrase d'exercice par forme conjuguée.
//
// Génération paresseuse, cache définitif : une phrase produite une fois est
// resservie à jamais. C'est ce qui rend le coût négligeable — l'inventaire de
// verbes est fini — et évite d'avoir à dupliquer la liste des verbes côté Go
// pour un travail en lot. Le client sait quelles formes il veut ; il les
// demande, le serveur complète ce qui manque.
func sentences(pool *pgxpool.Pool, client *ai.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req sentencesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		if req.Lang == "" || req.Lemma == "" || req.Tense == "" || len(req.Forms) == 0 {
			writeError(w, http.StatusBadRequest, fmt.Errorf("lang, lemma, tense et forms sont requis"))
			return
		}

		cached, err := loadSentences(r.Context(), pool, req.Lang, req.Lemma, req.Tense)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		if len(cached) >= len(req.Forms) {
			writeJSON(w, http.StatusOK, sentencesResponse{Sentences: cached})
			return
		}

		if !client.Enabled() {
			// Sans clé, l'app retombe sur ses énoncés locaux. Un 503 le dit
			// clairement plutôt que de renvoyer une liste vide qui passerait
			// pour un succès.
			writeError(w, http.StatusServiceUnavailable, fmt.Errorf("génération non configurée"))
			return
		}

		generated, err := client.Sentences(r.Context(), req.Lang, req.Lemma, req.Tense, req.Forms)
		if err != nil {
			writeError(w, http.StatusBadGateway, err)
			return
		}

		formByPerson := map[string]string{}
		for _, f := range req.Forms {
			formByPerson[f.Person] = f.Form
		}
		kept := make([]ai.Sentence, 0, len(generated))
		for _, s := range generated {
			form, ok := formByPerson[s.Person]
			// Le cache est définitif : une mauvaise phrase écrite ici est
			// figée pour toujours. On écarte donc ce qui ne tient pas debout
			// — personne non demandée, champ vide, ou énoncé sans le blanc
			// « ___ », qui rendrait l'exercice impossible à poser.
			if !ok || s.PromptFr == "" || !strings.Contains(s.Prompt, "___") {
				continue
			}
			kept = append(kept, s)
			if err := saveSentence(r.Context(), pool, req.Lang, req.Lemma, req.Tense, s, form); err != nil {
				log.Printf("cache phrase %s/%s/%s: %v", req.Lang, req.Lemma, s.Person, err)
			}
		}

		writeJSON(w, http.StatusOK, sentencesResponse{Sentences: kept, Generated: true})
	}
}

func loadSentences(ctx context.Context, pool *pgxpool.Pool, lang, lemma, tense string) ([]ai.Sentence, error) {
	rows, err := pool.Query(ctx, `
		SELECT person, prompt, prompt_fr FROM conjug_sentence
		WHERE lang = $1 AND lemma = $2 AND tense = $3`, lang, lemma, tense)
	if err != nil {
		return nil, fmt.Errorf("load sentences: %w", err)
	}
	defer rows.Close()

	out := []ai.Sentence{}
	for rows.Next() {
		var s ai.Sentence
		if err := rows.Scan(&s.Person, &s.Prompt, &s.PromptFr); err != nil {
			return nil, fmt.Errorf("scan sentence: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func saveSentence(ctx context.Context, pool *pgxpool.Pool, lang, lemma, tense string, s ai.Sentence, form string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO conjug_sentence (lang, lemma, tense, person, prompt, prompt_fr, form)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (lang, lemma, tense, person) DO NOTHING`,
		lang, lemma, tense, s.Person, s.Prompt, s.PromptFr, form)
	return err
}
