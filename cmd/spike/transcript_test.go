package main

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

func TestParseItunesDuration(t *testing.T) {
	cases := []struct {
		in   string
		want time.Duration
	}{
		{"1500", 1500 * time.Second},
		{"25:30", 25*time.Minute + 30*time.Second},
		{"01:02:03", 1*time.Hour + 2*time.Minute + 3*time.Second},
		{"", 0},
		{"n/a", 0},
	}
	for _, c := range cases {
		got := parseItunesDuration(c.in)
		if got != c.want {
			t.Errorf("parseItunesDuration(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestSelectTranscript_PrefersVTT(t *testing.T) {
	transcripts := []rssTranscript{
		{URL: "a.srt", Type: "application/srt"},
		{URL: "a.vtt", Type: "text/vtt"},
		{URL: "a.json", Type: "application/json"},
	}
	got, format, ok := selectTranscript(transcripts)
	if !ok || format != "vtt" || got.URL != "a.vtt" {
		t.Errorf("selectTranscript = %+v, %q, %v", got, format, ok)
	}
}

func TestSelectTranscript_FallsBackToSRT(t *testing.T) {
	transcripts := []rssTranscript{
		{URL: "a.json", Type: "application/json"},
		{URL: "a.srt", Type: "application/x-subrip"},
	}
	got, format, ok := selectTranscript(transcripts)
	if !ok || format != "srt" || got.URL != "a.srt" {
		t.Errorf("selectTranscript = %+v, %q, %v", got, format, ok)
	}
}

func TestSelectTranscript_NoUsableFormat(t *testing.T) {
	transcripts := []rssTranscript{
		{URL: "a.json", Type: "application/json"},
		{URL: "a.html", Type: "text/html"},
	}
	_, _, ok := selectTranscript(transcripts)
	if ok {
		t.Error("expected ok=false when no VTT/SRT available")
	}
}
