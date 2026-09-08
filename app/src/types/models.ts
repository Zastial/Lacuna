// Miroir des types renvoyés par l'API backend (voir internal/apihttp côté Go)
// et des tables locales SQLite (§6.2 du plan).

// Mode Articles : contenu texte du jour, tiré de vrais flux RSS de médias
// (§ pas d'IA, pas de contenu généré — le résumé est celui publié par la
// source). `summary` est l'extrait RSS, pas l'article complet ; `url` pointe
// vers l'article original pour la lecture intégrale.
export interface ApiArticle {
  id: number
  source_name: string
  lang: string
  title: string
  summary: string
  url: string
  published_at: string | null
  rare_ratio: number | null
}

export type CaptureKind = 'not_understood' | 'unknown_word' | 'liked'

// --- Mode FONDATIONS : scénarios situationnels pour construire le
// vocabulaire de base avant que l'écoute seule (TRANSPORT/REVUE) ne soit
// exploitable. Contenu entièrement pré-rédigé (pas d'IA), même logique que
// les listes de fréquence : déterministe et embarqué dans l'app.

export interface ScenarioLine {
  speaker: string
  target: string
  fr: string
}

export interface ScenarioVocab {
  target: string
  fr: string
}

export interface ScenarioMCQOption {
  target: string
  // Traduction montrée une fois la réponse donnée, sur toutes les options :
  // savoir pourquoi les autres étaient fausses vaut autant que la bonne.
  fr: string
  correct: boolean
}

export interface ScenarioMCQ {
  prompt: string
  fr: string
  options: ScenarioMCQOption[]
  hint: string
}

// id stable et global (ex: "it-volere-io-presente") : sert de clé de
// révision espacée indépendante de tout segment audio, et permet de piocher
// un même item depuis plusieurs scénarios pour l'entraînement entrelacé.
export interface ConjugItem {
  id: string
  verb: string
  tense: string
  prompt: string
  options: string[]
  answer: string
  // Traduction française du verbe, affichée à côté du lemme sur les items
  // générés (les scénarios écrits à la main la donnent déjà en contexte).
  hint?: string
  // Traduction française de la phrase complète, montrée après la réponse.
  // Absente sur les items générés, dont la phrase se réduit au pronom et au
  // verbe : le lemme français et le temps sont déjà affichés au-dessus.
  promptFr?: string
}

export interface Scenario {
  id: string
  lang: string
  title: string
  icon: string
  dialogue: ScenarioLine[]
  vocab: ScenarioVocab[]
  mcqs: ScenarioMCQ[]
  conjugation: ConjugItem[]
}

// État FSRS d'un item de vocabulaire/conjugaison FONDATIONS — même structure
// que ReviewState mais sans lien à un segment audio (itemId = ConjugItem.id
// ou "vocab:<lang>:<target>"). Réutilisée telle quelle pour Culture G
// (table SQLite séparée, mais même forme FSRS générique).
export interface VocabReviewState {
  itemId: string
  lang: string
  dueAt: number
  stability: number
  difficulty: number
  reps: number
  lapses: number
  lastGrade: number | null
  lastReview: number | null
  synced: boolean
}

// --- Mode Culture G : questions de culture générale rédigées dans la
// langue cible, mode dédié avec sa propre file de révision (FSRS, table
// cultureg_review_state) et son propre score cumulé.

export interface CultureOption {
  target: string
  correct: boolean
}

export interface CultureQuestion {
  id: string
  lang: string
  category: string
  prompt: string
  promptFr: string
  options: CultureOption[]
  // Traduction française de la bonne réponse — seulement quand elle diffère
  // du nom dans la langue cible (un nom propre identique dans les deux
  // langues n'a pas besoin d'être répété).
  answerFr?: string
  explanation: string
  explanationTarget: string
}

export interface CultureStats {
  lang: string
  correct: number
  total: number
}

// Vidéo YouTube proposée par centre d'intérêt. Pas de transcript : YouTube ne
// sert plus ses sous-titres aux clients tiers, donc pas d'unité de révision
// dérivée d'une vidéo — c'est du contenu à regarder, pas à découper.
export interface ApiVideo {
  id: number
  youtube_id: string
  channel_name: string
  lang: string
  category: string
  title: string
  description: string
  thumbnail_url: string
  published_at: string | null
}
