package transcript

import (
	"strings"
	"testing"
	"time"
)

func TestParseVTT(t *testing.T) {
	input := `WEBVTT

00:00:01.000 --> 00:00:04.500
Hola, ¿cómo estás?

00:00:04.500 --> 00:00:07.000 align:start
Todo bien, gracias.
`
	cues, err := ParseVTT(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseVTT: %v", err)
	}
	if len(cues) != 2 {
		t.Fatalf("got %d cues, want 2", len(cues))
	}
	if cues[0].Start != 1*time.Second || cues[0].End != 4500*time.Millisecond {
		t.Errorf("cue 0 timing = %v-%v", cues[0].Start, cues[0].End)
	}
	if cues[0].Text != "Hola, ¿cómo estás?" {
		t.Errorf("cue 0 text = %q", cues[0].Text)
	}
	// La ligne de fin porte des "cue settings" (align:start) : doit être ignorée.
	if cues[1].End != 7*time.Second {
		t.Errorf("cue 1 end = %v, want 7s (cue settings should be stripped)", cues[1].End)
	}
}

func TestParseVTT_MultilineCue(t *testing.T) {
	input := `WEBVTT

00:00:00.000 --> 00:00:03.000
Première ligne
Deuxième ligne
`
	cues, err := ParseVTT(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseVTT: %v", err)
	}
	if len(cues) != 1 {
		t.Fatalf("got %d cues, want 1", len(cues))
	}
	if cues[0].Text != "Première ligne Deuxième ligne" {
		t.Errorf("text = %q", cues[0].Text)
	}
}

func TestParseVTT_StripsVoiceTags(t *testing.T) {
	// Cas réel observé sur El Hilo : plusieurs locuteurs marqués par des
	// balises <v ...> au sein d'un même cue multi-lignes.
	input := `WEBVTT

00:00:01.010 --> 00:00:09.869
<v Speaker 1>Bienvenidos a El Hilo.
<v Speaker 2>Puede que el nombre no le suene.
`
	cues, err := ParseVTT(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseVTT: %v", err)
	}
	if len(cues) != 1 {
		t.Fatalf("got %d cues, want 1", len(cues))
	}
	want := "Bienvenidos a El Hilo. Puede que el nombre no le suene."
	if cues[0].Text != want {
		t.Errorf("text = %q, want %q", cues[0].Text, want)
	}
}

func TestParseSRT(t *testing.T) {
	input := `1
00:00:01,000 --> 00:00:04,500
Ciao, come stai?

2
00:01:05,200 --> 00:01:07,800
Tutto bene, grazie.
`
	cues, err := ParseSRT(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseSRT: %v", err)
	}
	if len(cues) != 2 {
		t.Fatalf("got %d cues, want 2", len(cues))
	}
	if cues[1].Start != 65*time.Second+200*time.Millisecond {
		t.Errorf("cue 1 start = %v", cues[1].Start)
	}
	if cues[1].Text != "Tutto bene, grazie." {
		t.Errorf("cue 1 text = %q", cues[1].Text)
	}
}

func TestParseSRT_CueWithoutText(t *testing.T) {
	// Un cue sans texte (silence marqué) ne doit pas faire planter le parseur.
	input := `1
00:00:01,000 --> 00:00:02,000

2
00:00:02,000 --> 00:00:03,000
Texte présent.
`
	cues, err := ParseSRT(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseSRT: %v", err)
	}
	if len(cues) != 2 {
		t.Fatalf("got %d cues, want 2", len(cues))
	}
	if cues[0].Text != "" {
		t.Errorf("cue 0 text = %q, want empty", cues[0].Text)
	}
	if cues[1].Text != "Texte présent." {
		t.Errorf("cue 1 text = %q", cues[1].Text)
	}
}

func TestParseTimestamp(t *testing.T) {
	cases := []struct {
		in   string
		want time.Duration
	}{
		{"00:00:01.500", 1500 * time.Millisecond},
		{"01:02:03.250", 1*time.Hour + 2*time.Minute + 3*time.Second + 250*time.Millisecond},
		{"02:03.250", 2*time.Minute + 3*time.Second + 250*time.Millisecond},
		{"00:00:01,500", 1500 * time.Millisecond}, // séparateur SRT
	}
	for _, c := range cases {
		got, err := parseTimestamp(c.in)
		if err != nil {
			t.Errorf("parseTimestamp(%q): %v", c.in, err)
			continue
		}
		if got != c.want {
			t.Errorf("parseTimestamp(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}
