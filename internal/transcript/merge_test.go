package transcript

import (
	"testing"
	"time"
)

func sec(n float64) time.Duration { return time.Duration(n * float64(time.Second)) }

func TestMergeCues_FlushesOnSentenceEndAfterMinDuration(t *testing.T) {
	cues := []Cue{
		{Start: sec(0), End: sec(1), Text: "Hola,"},
		{Start: sec(1), End: sec(2), Text: "¿cómo"},
		{Start: sec(2), End: sec(3.5), Text: "estás?"},
		{Start: sec(3.5), End: sec(5), Text: "Todo bien."},
	}
	got := MergeCues(cues, DefaultMergeOptions())
	if len(got) != 2 {
		t.Fatalf("got %d segments, want 2: %+v", len(got), got)
	}
	if got[0].Text != "Hola, ¿cómo estás?" {
		t.Errorf("segment 0 text = %q", got[0].Text)
	}
	if got[0].End != sec(3.5) {
		t.Errorf("segment 0 end = %v, want 3.5s", got[0].End)
	}
}

func TestMergeCues_ForcesFlushAtMaxDuration(t *testing.T) {
	// Parole continue sans ponctuation de fin de phrase avant 15s : doit
	// quand même flush pour ne pas produire un segment interminable.
	opts := DefaultMergeOptions()
	var cues []Cue
	for i := 0; i < 20; i++ {
		start := sec(float64(i))
		cues = append(cues, Cue{Start: start, End: start + sec(1), Text: "mot"})
	}
	got := MergeCues(cues, opts)
	if len(got) < 2 {
		t.Fatalf("expected at least 2 segments (forced flush), got %d", len(got))
	}
	for _, seg := range got {
		if seg.End-seg.Start > opts.MaxDuration {
			t.Errorf("segment duration %v exceeds MaxDuration %v", seg.End-seg.Start, opts.MaxDuration)
		}
	}
}

func TestMergeCues_MergesShortTailIntoPrevious(t *testing.T) {
	cues := []Cue{
		{Start: sec(0), End: sec(1), Text: "Bonjour,"},
		{Start: sec(1), End: sec(3.2), Text: "comment ça va?"}, // flush #1 : dur=3.2s >= 3s, fin de phrase
		{Start: sec(3.2), End: sec(4.5), Text: "Très bien,"},
		{Start: sec(4.5), End: sec(6.5), Text: "merci beaucoup."}, // flush #2 : dur=3.3s >= 3s, fin de phrase
		{Start: sec(6.5), End: sec(7.0), Text: "Fin."},            // trop courte pour tenir seule (0.5s < 1.5s)
	}
	got := MergeCues(cues, DefaultMergeOptions())
	if len(got) != 2 {
		t.Fatalf("got %d segments, want 2 (tail merged into #2): %+v", len(got), got)
	}
	if got[0].Text != "Bonjour, comment ça va?" {
		t.Errorf("segment 0 text = %q", got[0].Text)
	}
	last := got[len(got)-1]
	if last.End != sec(7.0) {
		t.Errorf("last segment end = %v, want 7s", last.End)
	}
	if last.Text != "Très bien, merci beaucoup. Fin." {
		t.Errorf("last segment text = %q", last.Text)
	}
}

func TestMergeCues_Empty(t *testing.T) {
	if got := MergeCues(nil, DefaultMergeOptions()); got != nil {
		t.Errorf("expected nil for empty input, got %+v", got)
	}
}

func TestEndsSentence(t *testing.T) {
	cases := map[string]bool{
		"Hola.":      true,
		"¿Qué pasa?": true,
		"¡Vaya!":     true,
		"et donc":    false,
		"mot":        false,
		"Fin…":       true,
		"«Ciao!»":    true,
	}
	for text, want := range cases {
		if got := endsSentence(text); got != want {
			t.Errorf("endsSentence(%q) = %v, want %v", text, got, want)
		}
	}
}
