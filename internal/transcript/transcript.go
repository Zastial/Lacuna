package transcript

import (
	"bufio"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Cue est un segment de transcript aligné, indépendant du format source
// (VTT ou SRT) — c'est ce que la Phase 1 transformera en table `segment`.
type Cue struct {
	Start time.Duration
	End   time.Duration
	Text  string
}

var vttTimingRe = regexp.MustCompile(`(\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}`)

// vttTagRe reconnaît les balises inline WebVTT (<v Speaker 1>, <c>, <b>, <i>,
// horodatages <00:00:01.000>...) : de la mise en forme, pas du contenu à
// garder dans le texte du segment.
var vttTagRe = regexp.MustCompile(`<[^>]*>`)

func stripTags(s string) string {
	return strings.TrimSpace(vttTagRe.ReplaceAllString(s, ""))
}

// ParseVTT lit un fichier WebVTT et renvoie les cues dans l'ordre. Tolère les
// identifiants de cue optionnels et les lignes NOTE/STYLE en les ignorant.
func ParseVTT(r io.Reader) ([]Cue, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var cues []Cue
	for scanner.Scan() {
		line := scanner.Text()
		if !vttTimingRe.MatchString(line) {
			continue
		}
		start, end, err := parseTimingLine(line)
		if err != nil {
			return nil, fmt.Errorf("timing line %q: %w", line, err)
		}

		var textLines []string
		for scanner.Scan() {
			raw := scanner.Text()
			if strings.TrimSpace(raw) == "" {
				break // ligne vide = fin du bloc de cue
			}
			if l := stripTags(raw); l != "" {
				textLines = append(textLines, l)
			}
			// une ligne réduite à des balises (ex: horodatage inline) ne
			// produit aucun texte, mais n'arrête pas le bloc pour autant.
		}
		cues = append(cues, Cue{Start: start, End: end, Text: strings.Join(textLines, " ")})
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return cues, nil
}

// ParseSRT lit un fichier SubRip. Format : numéro de cue, ligne de timing,
// lignes de texte, ligne vide.
func ParseSRT(r io.Reader) ([]Cue, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var cues []Cue
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if !vttTimingRe.MatchString(line) {
			// Ligne de numéro de cue (ou bruit) : on l'ignore, le timing suit.
			continue
		}
		start, end, err := parseTimingLine(line)
		if err != nil {
			return nil, fmt.Errorf("timing line %q: %w", line, err)
		}

		var textLines []string
		for scanner.Scan() {
			raw := scanner.Text()
			if strings.TrimSpace(raw) == "" {
				break
			}
			if l := stripTags(raw); l != "" {
				textLines = append(textLines, l)
			}
		}
		cues = append(cues, Cue{Start: start, End: end, Text: strings.Join(textLines, " ")})
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return cues, nil
}

func parseTimingLine(line string) (time.Duration, time.Duration, error) {
	parts := strings.SplitN(line, "-->", 2)
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("no --> separator")
	}
	start, err := parseTimestamp(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0, fmt.Errorf("start: %w", err)
	}
	// La borne de fin peut être suivie de "cue settings" VTT (align:..., etc).
	endField := strings.Fields(strings.TrimSpace(parts[1]))
	if len(endField) == 0 {
		return 0, 0, fmt.Errorf("missing end timestamp")
	}
	end, err := parseTimestamp(endField[0])
	if err != nil {
		return 0, 0, fmt.Errorf("end: %w", err)
	}
	return start, end, nil
}

// parseTimestamp accepte HH:MM:SS.mmm / MM:SS.mmm (VTT) et HH:MM:SS,mmm (SRT).
func parseTimestamp(s string) (time.Duration, error) {
	s = strings.ReplaceAll(s, ",", ".")
	fields := strings.Split(s, ":")

	var h, m int
	var secStr string
	switch len(fields) {
	case 3:
		var err error
		h, err = strconv.Atoi(fields[0])
		if err != nil {
			return 0, err
		}
		m, err = strconv.Atoi(fields[1])
		if err != nil {
			return 0, err
		}
		secStr = fields[2]
	case 2:
		var err error
		m, err = strconv.Atoi(fields[0])
		if err != nil {
			return 0, err
		}
		secStr = fields[1]
	default:
		return 0, fmt.Errorf("unexpected timestamp shape %q", s)
	}

	sec, err := strconv.ParseFloat(secStr, 64)
	if err != nil {
		return 0, err
	}

	total := time.Duration(h)*time.Hour + time.Duration(m)*time.Minute + time.Duration(sec*float64(time.Second))
	return total, nil
}
