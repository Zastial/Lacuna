// Package rssfeed télécharge et parse les flux RSS de podcasts, avec le
// namespace Podcasting 2.0 pour la balise <podcast:transcript>. Gère le
// cache conditionnel (ETag / If-Modified-Since) et le backoff — §8 Phase 1.
package rssfeed

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const userAgent = "Lacuna-Ingester/0.1 (+podcast ingestion; see PLAN-PROJET.md)"

type Feed struct {
	XMLName xml.Name `xml:"rss"`
	Channel Channel  `xml:"channel"`
}

type Channel struct {
	Title string `xml:"title"`
	Items []Item `xml:"item"`
}

type Item struct {
	Title       string       `xml:"title"`
	GUID        string       `xml:"guid"`
	Enclosure   Enclosure    `xml:"enclosure"`
	Duration    string       `xml:"http://www.itunes.com/dtds/podcast-1.0.dtd duration"`
	PubDate     string       `xml:"pubDate"`
	Transcripts []Transcript `xml:"https://podcastindex.org/namespace/1.0 transcript"`
}

type Enclosure struct {
	URL string `xml:"url,attr"`
}

type Transcript struct {
	URL      string `xml:"url,attr"`
	Type     string `xml:"type,attr"`
	Language string `xml:"language,attr"`
}

// FetchResult est le résultat d'un GET conditionnel : soit NotModified (304,
// rien à refaire), soit un corps de flux à parser avec de nouveaux
// ETag/LastModified à conserver pour le prochain passage.
type FetchResult struct {
	NotModified  bool
	Body         []byte
	ETag         string
	LastModified string
}

var httpClient = &http.Client{Timeout: 20 * time.Second}

// FetchFeed récupère un flux RSS en cache conditionnel : si prevETag ou
// prevLastModified sont fournis, envoie If-None-Match / If-Modified-Since.
func FetchFeed(ctx context.Context, url, prevETag, prevLastModified string) (*FetchResult, error) {
	headers := map[string]string{}
	if prevETag != "" {
		headers["If-None-Match"] = prevETag
	}
	if prevLastModified != "" {
		headers["If-Modified-Since"] = prevLastModified
	}

	status, header, body, err := getWithBackoff(ctx, url, headers)
	if err != nil {
		return nil, err
	}

	if status == http.StatusNotModified {
		return &FetchResult{NotModified: true}, nil
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("fetch feed %s: status %d", url, status)
	}

	return &FetchResult{
		Body:         body,
		ETag:         header.Get("ETag"),
		LastModified: header.Get("Last-Modified"),
	}, nil
}

// FetchURL télécharge un fichier (transcript, audio...) avec retry/backoff,
// sans cache conditionnel — utilisé pour les ressources sans ETag pertinent.
func FetchURL(ctx context.Context, url string) ([]byte, error) {
	status, _, body, err := getWithBackoff(ctx, url, nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("fetch %s: status %d", url, status)
	}
	return body, nil
}

const maxAttempts = 4

// getWithBackoff fait un GET avec backoff exponentiel sur 429/5xx, en
// respectant Retry-After s'il est présent.
func getWithBackoff(ctx context.Context, url string, headers map[string]string) (int, http.Header, []byte, error) {
	var lastErr error

	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return 0, nil, nil, ctx.Err()
			case <-time.After(backoffDelay(attempt)):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return 0, nil, nil, fmt.Errorf("build request: %w", err)
		}
		req.Header.Set("User-Agent", userAgent)
		for k, v := range headers {
			req.Header.Set(k, v)
		}

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

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("status %d", resp.StatusCode)
			if wait, ok := retryAfter(resp.Header.Get("Retry-After")); ok {
				select {
				case <-ctx.Done():
					return 0, nil, nil, ctx.Err()
				case <-time.After(wait):
				}
			}
			continue
		}

		return resp.StatusCode, resp.Header, body, nil
	}

	return 0, nil, nil, fmt.Errorf("after %d attempts: %w", maxAttempts, lastErr)
}

func backoffDelay(attempt int) time.Duration {
	d := time.Duration(1<<uint(attempt-1)) * time.Second // 1s, 2s, 4s...
	if d > 15*time.Second {
		d = 15 * time.Second
	}
	return d
}

func retryAfter(header string) (time.Duration, bool) {
	if header == "" {
		return 0, false
	}
	if secs, err := strconv.Atoi(header); err == nil {
		return time.Duration(secs) * time.Second, true
	}
	return 0, false
}

func Parse(body []byte) (*Feed, error) {
	var feed Feed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("parse rss xml: %w", err)
	}
	return &feed, nil
}

// SelectTranscript choisit le format le plus simple à parser (VTT d'abord,
// puis SRT) parmi les <podcast:transcript> d'un item.
func SelectTranscript(transcripts []Transcript) (Transcript, string, bool) {
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
	return Transcript{}, "", false
}

// ParseItunesDuration lit itunes:duration ("HH:MM:SS", "MM:SS" ou secondes).
func ParseItunesDuration(s string) time.Duration {
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

// ParsePubDate lit pubDate au format RFC1123Z (standard RSS), avec quelques
// variantes tolérées côté hébergeurs.
func ParsePubDate(s string) (time.Time, bool) {
	layouts := []string{time.RFC1123Z, time.RFC1123, time.RFC3339}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, strings.TrimSpace(s)); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}
