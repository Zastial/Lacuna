// Package frequency calcule la difficulté d'un segment de façon
// déterministe (§6.3 du plan) : proportion de tokens absents des N mots les
// plus fréquents de la langue. Aucun traitement statistique au-delà d'un
// classement par rang — pas de métrique de lisibilité sophistiquée.
package frequency

import (
	"bufio"
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	frequencydata "lacuna/data/frequency"
	"lacuna/internal/models"
)

// Thresholds : N mots les plus fréquents retenus selon le niveau de la
// langue visée (§6.3 — 1000 débutant, 3000 intermédiaire, 5000 avancé).
var Thresholds = map[string]int{
	"beginner":     1000,
	"intermediate": 3000,
	"native":       5000,
}

var wordRe = regexp.MustCompile(`\p{L}+`)

// Tokenize découpe un texte en mots (suites de lettres Unicode, minuscules).
// Volontairement simple : les apostrophes coupent le mot (l'italiano -> l,
// italiano), cohérent avec le tokenizer utilisé pour construire les listes
// de fréquence source.
func Tokenize(text string) []string {
	matches := wordRe.FindAllString(strings.ToLower(text), -1)
	return matches
}

// LoadEmbedded lit une liste de fréquence embarquée (data/frequency/<lang>.txt,
// format "mot\tcompte" trié par fréquence décroissante) et renvoie les mots
// dans l'ordre, rang = position dans le fichier (1-indexé).
func LoadEmbedded(lang string) ([]models.FrequencyWord, error) {
	f, err := frequencydata.FS.Open(lang + ".txt")
	if err != nil {
		return nil, fmt.Errorf("open frequency list for %q: %w", lang, err)
	}
	defer f.Close()

	var words []models.FrequencyWord
	scanner := bufio.NewScanner(f)
	rank := 0
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		rank++
		words = append(words, models.FrequencyWord{Lang: lang, Word: fields[0], Rank: rank})
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan frequency list for %q: %w", lang, err)
	}
	return words, nil
}

const upsertChunkSize = 1000

// Import charge et upsert les listes de fréquence embarquées pour les
// langues données dans la table frequency_word. Idempotent.
func Import(ctx context.Context, pool *pgxpool.Pool, langs []string) error {
	const upsertSQL = `INSERT INTO frequency_word (lang, word, rank) VALUES ($1, $2, $3)
		ON CONFLICT (lang, word) DO UPDATE SET rank = EXCLUDED.rank`

	for _, lang := range langs {
		words, err := LoadEmbedded(lang)
		if err != nil {
			return err
		}

		for start := 0; start < len(words); start += upsertChunkSize {
			end := min(start+upsertChunkSize, len(words))

			batch := &pgx.Batch{}
			for _, w := range words[start:end] {
				batch.Queue(upsertSQL, w.Lang, w.Word, w.Rank)
			}

			br := pool.SendBatch(ctx, batch)
			for range words[start:end] {
				if _, err := br.Exec(); err != nil {
					br.Close()
					return fmt.Errorf("import frequency words for %q: %w", lang, err)
				}
			}
			if err := br.Close(); err != nil {
				return fmt.Errorf("import frequency words for %q: %w", lang, err)
			}
		}
	}
	return nil
}

// RankSet est l'ensemble des mots dans le top-N pour une langue, prêt pour
// des lookups O(1) lors du calcul de rare_ratio sur de nombreux segments.
type RankSet map[string]struct{}

// LoadRankSet charge depuis la base les mots de rang <= threshold pour une
// langue.
func LoadRankSet(ctx context.Context, pool *pgxpool.Pool, lang string, threshold int) (RankSet, error) {
	rows, err := pool.Query(ctx, `SELECT word FROM frequency_word WHERE lang = $1 AND rank <= $2`, lang, threshold)
	if err != nil {
		return nil, fmt.Errorf("query frequency words: %w", err)
	}
	defer rows.Close()

	set := make(RankSet)
	for rows.Next() {
		var word string
		if err := rows.Scan(&word); err != nil {
			return nil, err
		}
		set[word] = struct{}{}
	}
	return set, rows.Err()
}

// RareRatio calcule la proportion de tokens du texte absents de set. Un
// texte sans aucun token exploitable (vide, ponctuation seule) renvoie 0.
func RareRatio(text string, set RankSet) float64 {
	tokens := Tokenize(text)
	if len(tokens) == 0 {
		return 0
	}
	rare := 0
	for _, tok := range tokens {
		if _, ok := set[tok]; !ok {
			rare++
		}
	}
	return float64(rare) / float64(len(tokens))
}
