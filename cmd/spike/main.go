// Command spike est le binaire bloquant de la Phase 0 (§8 de PLAN-PROJET.md) :
// il vérifie, sur une liste de flux RSS candidats, lesquels exposent un
// transcript exploitable (timestamp ↔ texte) via la balise Podcasting 2.0
// <podcast:transcript>. C'est le seul risque capable d'invalider le concept
// produit ; rien d'autre ne démarre tant que le critère de sortie n'est pas
// évalué.
package main

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/sync/errgroup"
)

const maxConcurrentFeeds = 5

func main() {
	ctx := context.Background()

	reports := make([]FeedReport, len(candidateFeeds))
	sem := make(chan struct{}, maxConcurrentFeeds)

	g, gctx := errgroup.WithContext(ctx)
	for i, feed := range candidateFeeds {
		i, feed := i, feed
		g.Go(func() error {
			sem <- struct{}{}
			defer func() { <-sem }()
			reports[i] = probeFeed(gctx, feed)
			return nil // les échecs individuels sont dans le rapport, pas fatals
		})
	}
	_ = g.Wait()

	if err := writeReport(reports, "spike-report.txt"); err != nil {
		fmt.Println("erreur d'écriture du rapport:", err)
	}
}

// probeFeed télécharge un flux, cherche le premier épisode récent avec un
// transcript exploitable (VTT ou SRT) et calcule les statistiques du rapport.
func probeFeed(ctx context.Context, feed Feed) FeedReport {
	report := FeedReport{Feed: feed}

	body, status, err := fetchWithRetry(ctx, feed.URL)
	if err != nil {
		report.Status = statusFromErr(status)
		report.Error = err.Error()
		return report
	}

	rss, err := parseRSS(body)
	if err != nil {
		report.Status = "parse_error"
		report.Error = err.Error()
		return report
	}

	if len(rss.Channel.Items) == 0 {
		report.Status = "empty_feed"
		return report
	}

	// On ne regarde que les épisodes les plus récents : si un flux a activé
	// les transcripts, ils sont quasi toujours présents sur tous les items
	// récents (constaté pendant la recherche préalable).
	limit := min(5, len(rss.Channel.Items))
	for _, item := range rss.Channel.Items[:limit] {
		t, format, ok := selectTranscript(item.Transcripts)
		if !ok {
			continue
		}

		report.EpisodeTitle = item.Title
		report.Format = format
		report.EpisodeDuration = parseItunesDuration(item.Duration)

		tbody, tstatus, terr := fetchWithRetry(ctx, t.URL)
		if terr != nil {
			report.Status = statusFromErr(tstatus)
			report.Error = terr.Error()
			return report
		}

		var cues []Cue
		var perr error
		if format == "vtt" {
			cues, perr = ParseVTT(bytes.NewReader(tbody))
		} else {
			cues, perr = ParseSRT(bytes.NewReader(tbody))
		}
		if perr != nil {
			report.Status = "transcript_parse_error"
			report.Error = perr.Error()
			return report
		}
		if len(cues) == 0 {
			report.Status = "empty_transcript"
			return report
		}

		report.Status = "ok"
		report.CueCount = len(cues)

		last := cues[len(cues)-1]
		if report.EpisodeDuration > 0 {
			report.CoverageRatio = float64(last.End) / float64(report.EpisodeDuration)
		}

		var totalCueDur time.Duration
		for _, c := range cues {
			totalCueDur += c.End - c.Start
		}
		report.AvgCueDuration = totalCueDur / time.Duration(len(cues))
		return report
	}

	report.Status = "no_transcript"
	return report
}

func statusFromErr(httpStatus int) string {
	switch {
	case httpStatus == http.StatusForbidden:
		return "http_403"
	case httpStatus >= 500:
		return "http_5xx"
	default:
		return "fetch_error"
	}
}
