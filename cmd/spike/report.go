package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// FeedReport est le résultat de la sonde pour un flux : soit "ok" avec des
// statistiques exploitables, soit un statut d'échec explicite (jamais un
// simple booléen — on veut savoir POURQUOI un flux échoue pour trancher les
// replis du §8 en connaissance de cause).
type FeedReport struct {
	Feed  Feed
	Status string // ok | no_transcript | http_403 | http_5xx | fetch_error | parse_error | empty_feed | transcript_parse_error | empty_transcript
	Error string

	EpisodeTitle       string
	Format             string
	TranscriptLanguage string // attribut "language" de la balise podcast:transcript, si présent
	EpisodeDuration    time.Duration
	CueCount           int
	CoverageRatio      float64 // 0 si la durée d'épisode était inconnue
	AvgCueDuration     time.Duration
}

func (r FeedReport) exploitable() bool {
	return r.Status == "ok"
}

// parseItunesDuration lit itunes:duration, qui varie entre "HH:MM:SS",
// "MM:SS" et un nombre de secondes brut selon les hébergeurs.
func parseItunesDuration(s string) time.Duration {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	parts := strings.Split(s, ":")
	var h, m, sec int
	var err error
	switch len(parts) {
	case 1:
		sec, err = strconv.Atoi(parts[0])
	case 2:
		if m, err = strconv.Atoi(parts[0]); err == nil {
			sec, err = strconv.Atoi(parts[1])
		}
	case 3:
		if h, err = strconv.Atoi(parts[0]); err == nil {
			if m, err = strconv.Atoi(parts[1]); err == nil {
				sec, err = strconv.Atoi(parts[2])
			}
		}
	default:
		return 0
	}
	if err != nil {
		return 0
	}
	return time.Duration(h)*time.Hour + time.Duration(m)*time.Minute + time.Duration(sec)*time.Second
}

func writeReport(reports []FeedReport, path string) error {
	var b strings.Builder

	fmt.Fprintf(&b, "Lacuna — Phase 0 spike transcripts — %s\n", time.Now().Format(time.RFC3339))
	fmt.Fprintf(&b, "%d flux testés\n\n", len(reports))

	for _, r := range reports {
		fmt.Fprintf(&b, "=== %s (%s / %s) ===\n", r.Feed.Name, r.Feed.Lang, r.Feed.Level)
		fmt.Fprintf(&b, "url: %s\n", r.Feed.URL)
		fmt.Fprintf(&b, "status: %s\n", r.Status)
		if r.Error != "" {
			fmt.Fprintf(&b, "error: %s\n", r.Error)
		}
		if r.exploitable() {
			fmt.Fprintf(&b, "episode: %s\n", r.EpisodeTitle)
			fmt.Fprintf(&b, "format: %s\n", r.Format)
			if r.TranscriptLanguage != "" && r.TranscriptLanguage != r.Feed.Lang {
				fmt.Fprintf(&b, "ATTENTION langue transcript déclarée = %q (≠ %s attendu) — vérifier manuellement avant utilisation\n", r.TranscriptLanguage, r.Feed.Lang)
			}
			fmt.Fprintf(&b, "segments: %d\n", r.CueCount)
			fmt.Fprintf(&b, "duree_moyenne_segment: %s\n", r.AvgCueDuration.Round(100*time.Millisecond))
			if r.EpisodeDuration > 0 {
				fmt.Fprintf(&b, "duree_episode: %s\n", r.EpisodeDuration)
				fmt.Fprintf(&b, "couverture_temporelle: %.0f%%\n", r.CoverageRatio*100)
			}
		}
		b.WriteString("\n")
	}

	b.WriteString("=== Résumé par langue ===\n")
	for _, lang := range []string{"en", "es", "it"} {
		total, ok := 0, 0
		for _, r := range reports {
			if r.Feed.Lang != lang {
				continue
			}
			total++
			if r.exploitable() {
				ok++
			}
		}
		verdict := "❌ critère non atteint (< 2)"
		if ok >= 2 {
			verdict = "✅ critère atteint"
		}
		fmt.Fprintf(&b, "%s : %d/%d flux exploitables — %s\n", lang, ok, total, verdict)
	}

	fmt.Print(b.String())
	return os.WriteFile(path, []byte(b.String()), 0o644)
}
