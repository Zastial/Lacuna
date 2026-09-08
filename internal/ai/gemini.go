// Package ai corrige les phrases produites par l'apprenant.
//
// C'est la seule partie du projet qui appelle un service distant de modèle de
// langue, et elle vit côté serveur pour une raison non négociable : une clé
// d'API embarquée dans un bundle iOS s'extrait en quelques minutes.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Modèle stable, choisi après avoir listé ce que la clé donne réellement
// plutôt que d'en deviner un — les identifiants Gemini changent souvent, et
// les variantes « preview » ne sont pas faites pour durer.
const model = "gemini-3.5-flash"

const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"

// maxInput borne ce qu'on transmet. Une phrase d'entraînement fait quelques
// mots ; au-delà, c'est une erreur d'appel ou un abus, et les deux coûtent
// du quota.
const maxInput = 500

var httpClient = &http.Client{Timeout: 30 * time.Second}

type Correction struct {
	OK          bool   `json:"ok"`
	Corrected   string `json:"corrected"`
	Explanation string `json:"explanation"`
}

type Client struct {
	apiKey string
}

func NewClient(apiKey string) *Client {
	return &Client{apiKey: strings.TrimSpace(apiKey)}
}

// Enabled dit si la correction est utilisable. Sans clé, l'app doit masquer
// la fonctionnalité plutôt que proposer un bouton qui échoue.
func (c *Client) Enabled() bool {
	return c.apiKey != ""
}

const systemPrompt = `Tu corriges des phrases produites à l'oral par un francophone qui apprend %s.
Il vise une phrase précise mais toute formulation correcte et naturelle est acceptable.

Réponds UNIQUEMENT en JSON : {"ok": bool, "corrected": "phrase correcte", "explanation": "explication"}

- ok = true si ce qu'il a dit est correct et naturel, même si ce n'est pas mot pour mot la phrase visée.
- corrected : la phrase telle qu'un natif la dirait.
- explanation : UNE ou DEUX phrases en français, concrètes, qui nomment la règle en cause. Pas de jargon grammatical inutile. Vide si ok=true.

Le texte vient d'une dictée vocale : ignore la ponctuation et les majuscules manquantes, elles ne sont pas des fautes de l'apprenant.`

type geminiRequest struct {
	SystemInstruction *content          `json:"systemInstruction,omitempty"`
	Contents          []content         `json:"contents"`
	GenerationConfig  *generationConfig `json:"generationConfig,omitempty"`
}

type content struct {
	Parts []part `json:"parts"`
}

type part struct {
	Text string `json:"text"`
}

type generationConfig struct {
	ResponseMimeType string  `json:"responseMimeType,omitempty"`
	Temperature      float64 `json:"temperature"`
}

type geminiResponse struct {
	Candidates []struct {
		Content content `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Correct compare ce qui a été dit à la phrase visée et explique l'écart.
func (c *Client) Correct(ctx context.Context, lang, expected, expectedFr, said string) (*Correction, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("gemini: pas de clé configurée")
	}
	said = strings.TrimSpace(said)
	if said == "" {
		return nil, fmt.Errorf("gemini: rien à corriger")
	}
	if len(said) > maxInput || len(expected) > maxInput {
		return nil, fmt.Errorf("gemini: texte trop long")
	}

	language := "l'italien"
	if lang == "es" {
		language = "l'espagnol"
	}

	prompt := fmt.Sprintf("Sens visé (français) : %s\nPhrase visée : %s\nCe que l'apprenant a dit : %s",
		expectedFr, expected, said)

	body, err := json.Marshal(geminiRequest{
		SystemInstruction: &content{Parts: []part{{Text: fmt.Sprintf(systemPrompt, language)}}},
		Contents:          []content{{Parts: []part{{Text: prompt}}}},
		// Température basse : on veut une correction reproductible, pas une
		// reformulation différente à chaque essai sur la même faute.
		GenerationConfig: &generationConfig{ResponseMimeType: "application/json", Temperature: 0.2},
	})
	if err != nil {
		return nil, fmt.Errorf("gemini: encode request: %w", err)
	}

	url := endpoint + model + ":generateContent?key=" + c.apiKey
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("gemini: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini: %w", err)
	}
	defer resp.Body.Close()

	var parsed geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("gemini: decode response: %w", err)
	}
	if parsed.Error != nil {
		// Le palier gratuit a des limites de débit : cette erreur-là est
		// attendue en usage normal, pas un bug.
		return nil, fmt.Errorf("gemini: %s", parsed.Error.Message)
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("gemini: réponse vide")
	}

	var correction Correction
	if err := json.Unmarshal([]byte(parsed.Candidates[0].Content.Parts[0].Text), &correction); err != nil {
		return nil, fmt.Errorf("gemini: réponse non conforme au schéma: %w", err)
	}
	return &correction, nil
}
