package transcript

import (
	"strings"
	"time"
)

// MergeOptions contrôle la fusion des cues brutes (souvent 1-4s chacune,
// découpées pour du sous-titrage) en segments de révision (§8 Phase 1 :
// "viser 3-15s, ne jamais garder un cue de moins de 1,5s isolé").
type MergeOptions struct {
	MinDuration     time.Duration // durée visée avant de considérer un flush
	MaxDuration     time.Duration // durée au-delà de laquelle on force le flush
	MinTailDuration time.Duration // un dernier segment plus court que ça est fusionné au précédent
}

func DefaultMergeOptions() MergeOptions {
	return MergeOptions{
		MinDuration:     3 * time.Second,
		MaxDuration:     15 * time.Second,
		MinTailDuration: 1500 * time.Millisecond,
	}
}

// MergeCues fusionne des cues consécutives en segments d'environ une phrase.
// Heuristique : accumuler jusqu'à MinDuration, puis flush dès qu'un cue se
// termine par une ponctuation de fin de phrase, ou forcer le flush à
// MaxDuration si aucune ponctuation n'apparaît (parole continue, silence
// absent). Le dernier segment produit, s'il est trop court pour exister
// seul, est refondu dans le précédent plutôt que laissé isolé.
func MergeCues(cues []Cue, opts MergeOptions) []Cue {
	if len(cues) == 0 {
		return nil
	}

	var result []Cue
	var buf []Cue

	flush := func() {
		if len(buf) == 0 {
			return
		}
		texts := make([]string, 0, len(buf))
		for _, c := range buf {
			if c.Text != "" {
				texts = append(texts, c.Text)
			}
		}
		result = append(result, Cue{
			Start: buf[0].Start,
			End:   buf[len(buf)-1].End,
			Text:  strings.Join(texts, " "),
		})
		buf = nil
	}

	for i, c := range cues {
		buf = append(buf, c)
		dur := c.End - buf[0].Start
		isLast := i == len(cues)-1

		switch {
		case isLast:
			flush()
		case dur >= opts.MaxDuration:
			flush()
		case dur >= opts.MinDuration && endsSentence(c.Text):
			flush()
		}
	}

	return mergeShortTail(result, opts.MinTailDuration)
}

// mergeShortTail refond le dernier segment dans l'avant-dernier s'il est
// trop court pour tenir seul (fin d'épisode qui coupe l'accumulation avant
// d'atteindre MinDuration).
func mergeShortTail(segments []Cue, minTail time.Duration) []Cue {
	if len(segments) < 2 {
		return segments
	}
	last := segments[len(segments)-1]
	if last.End-last.Start >= minTail {
		return segments
	}
	prev := segments[len(segments)-2]
	merged := Cue{
		Start: prev.Start,
		End:   last.End,
		Text:  strings.TrimSpace(prev.Text + " " + last.Text),
	}
	segments = segments[:len(segments)-2]
	return append(segments, merged)
}

var sentenceEndings = []string{".", "!", "?", "…", ".\"", "!\"", "?\"", ".»", "!»", "?»"}

func endsSentence(text string) bool {
	text = strings.TrimSpace(text)
	for _, suf := range sentenceEndings {
		if strings.HasSuffix(text, suf) {
			return true
		}
	}
	return false
}
