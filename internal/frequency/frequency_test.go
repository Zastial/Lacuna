package frequency

import "testing"

func TestTokenize(t *testing.T) {
	got := Tokenize("¡Hola! ¿Cómo estás, l'amico?")
	want := []string{"hola", "cómo", "estás", "l", "amico"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("token %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestRareRatio(t *testing.T) {
	set := RankSet{"hola": {}, "cómo": {}, "estás": {}}
	cases := []struct {
		text string
		want float64
	}{
		{"Hola, ¿cómo estás?", 0},               // les 3 mots sont dans le set
		{"Hola, marcianos verdes vuelan", 0.75}, // 3 rares sur 4 tokens
		{"", 0},                                 // pas de tokens exploitables
		{"...", 0},
	}
	for _, c := range cases {
		got := RareRatio(c.text, set)
		if got != c.want {
			t.Errorf("RareRatio(%q) = %v, want %v", c.text, got, c.want)
		}
	}
}

func TestLoadEmbedded_RanksInOrder(t *testing.T) {
	for _, lang := range []string{"en", "es", "it"} {
		words, err := LoadEmbedded(lang)
		if err != nil {
			t.Fatalf("LoadEmbedded(%q): %v", lang, err)
		}
		if len(words) < 4000 {
			t.Errorf("LoadEmbedded(%q) returned only %d words, expected ~5000", lang, len(words))
		}
		for i, w := range words {
			if w.Rank != i+1 {
				t.Fatalf("LoadEmbedded(%q)[%d].Rank = %d, want %d", lang, i, w.Rank, i+1)
			}
			if w.Lang != lang {
				t.Fatalf("LoadEmbedded(%q)[%d].Lang = %q", lang, i, w.Lang)
			}
		}
	}
}
