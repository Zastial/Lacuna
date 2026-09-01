package main

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const podcastNS = "https://podcastindex.org/namespace/1.0"
const itunesNS = "http://www.itunes.com/dtds/podcast-1.0.dtd"

// userAgent imite un vrai client podcast : plusieurs flux (WordPress, Acast)
// renvoient un 403 générique aux clients HTTP par défaut (Go, curl sans -A).
const userAgent = "Lacuna-Spike/0.1 (+podcast research; contact via github)"

type rssFeed struct {
	XMLName xml.Name  `xml:"rss"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title string    `xml:"title"`
	Items []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string          `xml:"title"`
	GUID        string          `xml:"guid"`
	Enclosure   rssEnclosure    `xml:"enclosure"`
	Duration    string          `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd duration"`
	Transcripts []rssTranscript `xml:"https://podcastindex.org/namespace/1.0 transcript"`
}

type rssEnclosure struct {
	URL string `xml:"url,attr"`
}

type rssTranscript struct {
	URL      string `xml:"url,attr"`
	Type     string `xml:"type,attr"`
	Language string `xml:"language,attr"`
}

// httpClient est partagé par tous les fetch (feed + transcript), avec un
// timeout raisonnable pour ne pas bloquer indéfiniment sur un hébergeur lent.
var httpClient = &http.Client{Timeout: 20 * time.Second}

// fetchWithRetry récupère un corps HTTP en imitant un client podcast réel et
// en retentant une fois sur 403/5xx (protections anti-bot ou hoquet serveur).
func fetchWithRetry(ctx context.Context, url string) ([]byte, int, error) {
	var lastStatus int
	var lastErr error

	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			time.Sleep(1500 * time.Millisecond)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, 0, fmt.Errorf("build request: %w", err)
		}
		req.Header.Set("User-Agent", userAgent)
		req.Header.Set("Accept", "*/*")

		resp, err := httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("read body: %w", err)
			continue
		}

		lastStatus = resp.StatusCode
		if resp.StatusCode == http.StatusOK {
			return body, resp.StatusCode, nil
		}
		if resp.StatusCode == http.StatusForbidden || resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("status %d", resp.StatusCode)
			continue
		}
		// Autre statut (404, 401...) : inutile de retenter.
		return nil, resp.StatusCode, fmt.Errorf("status %d", resp.StatusCode)
	}

	return nil, lastStatus, lastErr
}

func parseRSS(body []byte) (*rssFeed, error) {
	var feed rssFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("parse rss xml: %w", err)
	}
	return &feed, nil
}

// selectTranscript choisit le format le plus facile à parser de façon
// déterministe parmi les <podcast:transcript> d'un item : VTT d'abord (le
// plus simple), puis SRT, sinon rien d'exploitable pour ce spike.
func selectTranscript(transcripts []rssTranscript) (rssTranscript, string, bool) {
	for _, t := range transcripts {
		if strings.Contains(strings.ToLower(t.Type), "vtt") {
			return t, "vtt", true
		}
	}
	for _, t := range transcripts {
		mime := strings.ToLower(t.Type)
		if strings.Contains(mime, "srt") || strings.Contains(mime, "subrip") {
			return t, "srt", true
		}
	}
	return rssTranscript{}, "", false
}
