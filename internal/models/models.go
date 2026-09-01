// Package models contient les structures partagées entre l'ingester et
// l'API — le miroir Go des tables PostgreSQL définies en §6.1 du plan.
package models

import "time"

type Feed struct {
	ID             int64
	RSSURL         string
	Title          string
	Lang           string // "en" | "es" | "it"
	Level          string // "beginner" | "intermediate" | "native"
	HasTranscripts bool
	ETag           *string
	LastModified   *string
	LastFetchedAt  *time.Time
}

type Episode struct {
	ID             int64
	FeedID         int64
	GUID           string
	Title          string
	AudioURL       string
	DurationS      *int
	PublishedAt    *time.Time
	TranscriptURL  *string
	TranscriptType *string // "vtt" | "srt" | "json" | nil
	SegmentsReady  bool
}

type Segment struct {
	ID        int64
	EpisodeID int64
	Idx       int
	StartMS   int
	EndMS     int
	Text      string
	Speaker   *string
	WordCount int
	RareRatio *float64
}

type FrequencyWord struct {
	Lang string
	Word string
	Rank int
}
