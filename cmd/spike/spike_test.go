package main

import (
	"testing"
	"time"
)

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
