package rssfeed

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestFetchFeed_NotModified(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("If-None-Match") == `"abc"` {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("ETag", `"abc"`)
		w.Write([]byte(`<rss><channel><title>T</title></channel></rss>`))
	}))
	defer srv.Close()

	res, err := FetchFeed(context.Background(), srv.URL, `"abc"`, "")
	if err != nil {
		t.Fatalf("FetchFeed: %v", err)
	}
	if !res.NotModified {
		t.Errorf("expected NotModified=true")
	}
}

func TestFetchFeed_ReturnsETag(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("ETag", `"xyz"`)
		w.Write([]byte(`<rss><channel><title>T</title></channel></rss>`))
	}))
	defer srv.Close()

	res, err := FetchFeed(context.Background(), srv.URL, "", "")
	if err != nil {
		t.Fatalf("FetchFeed: %v", err)
	}
	if res.NotModified {
		t.Fatalf("expected a fresh body, got NotModified")
	}
	if res.ETag != `"xyz"` {
		t.Errorf("ETag = %q, want %q", res.ETag, `"xyz"`)
	}
}

func TestGetWithBackoff_RetriesOn500(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	body, err := FetchURL(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("FetchURL: %v", err)
	}
	if string(body) != "ok" {
		t.Errorf("body = %q, want %q", body, "ok")
	}
	if calls != 3 {
		t.Errorf("calls = %d, want 3", calls)
	}
}

func TestParse_ExtractsTranscriptTag(t *testing.T) {
	xmlBody := []byte(`<?xml version="1.0"?>
<rss xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Mon Podcast</title>
    <item>
      <title>Episode 1</title>
      <guid>ep1</guid>
      <enclosure url="https://example.com/ep1.mp3"/>
      <itunes:duration>00:29:14</itunes:duration>
      <podcast:transcript url="https://example.com/ep1.vtt" type="text/vtt" language="es"/>
    </item>
  </channel>
</rss>`)

	feed, err := Parse(xmlBody)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(feed.Channel.Items) != 1 {
		t.Fatalf("got %d items, want 1", len(feed.Channel.Items))
	}
	item := feed.Channel.Items[0]
	if len(item.Transcripts) != 1 {
		t.Fatalf("got %d transcripts, want 1", len(item.Transcripts))
	}
	tr, format, ok := SelectTranscript(item.Transcripts)
	if !ok || format != "vtt" || tr.URL != "https://example.com/ep1.vtt" {
		t.Errorf("SelectTranscript = %+v, %q, %v", tr, format, ok)
	}
}
