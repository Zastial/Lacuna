import { getDB } from './sqlite'
import type { CultureStats, VocabReviewState } from '../types/models'

export async function getVocabReviewState(itemId: string): Promise<VocabReviewState | null> {
  const db = await getDB()
  const res = await db.query('SELECT * FROM vocab_review_state WHERE item_id = ?', [itemId])
  const row = res.values?.[0]
  return row ? rowToVocabReviewState(row) : null
}

export async function upsertVocabReviewState(state: VocabReviewState): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO vocab_review_state (item_id, lang, due_at, stability, difficulty, reps, lapses, last_grade, last_review, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       due_at = excluded.due_at, stability = excluded.stability, difficulty = excluded.difficulty,
       reps = excluded.reps, lapses = excluded.lapses, last_grade = excluded.last_grade,
       last_review = excluded.last_review, synced = excluded.synced`,
    [
      state.itemId, state.lang, state.dueAt, state.stability, state.difficulty,
      state.reps, state.lapses, state.lastGrade, state.lastReview, state.synced ? 1 : 0,
    ],
  )
}

// getDueVocabItems pioche jusqu'à `limit` items dus pour une langue, mélangés
// (pas triés par verbe/scénario) — alimente l'entraînement rapide sans son
// du mode FONDATIONS (à distinguer de l'entrelacement intégré aux scénarios,
// écrit à la main dans data/fondations).
export async function getDueVocabItems(lang: string, nowMs: number, limit = 20): Promise<VocabReviewState[]> {
  const db = await getDB()
  const res = await db.query(
    'SELECT * FROM vocab_review_state WHERE lang = ? AND due_at <= ? ORDER BY RANDOM() LIMIT ?',
    [lang, nowMs, limit],
  )
  return (res.values ?? []).map(rowToVocabReviewState)
}

// getAllVocabReviewStatesForLang alimente le calcul de maîtrise par verbe
// (bronze/argent/or, mode FONDATIONS) — contrairement à getDueVocabItems,
// prend tout, pas seulement ce qui est dû aujourd'hui.
export async function getAllVocabReviewStatesForLang(lang: string): Promise<VocabReviewState[]> {
  const db = await getDB()
  const res = await db.query('SELECT * FROM vocab_review_state WHERE lang = ?', [lang])
  return (res.values ?? []).map(rowToVocabReviewState)
}

export async function getCompletedScenarioIds(): Promise<Set<string>> {
  const db = await getDB()
  const res = await db.query('SELECT scenario_id FROM fondations_progress')
  return new Set((res.values ?? []).map((row) => row.scenario_id as string))
}

export async function markScenarioCompleted(scenarioId: string): Promise<void> {
  const db = await getDB()
  await db.run(
    'INSERT INTO fondations_progress (scenario_id, completed_at) VALUES (?, ?) ON CONFLICT(scenario_id) DO NOTHING',
    [scenarioId, Date.now()],
  )
}

// --- Culture G : file de révision dédiée + score cumulé (table séparée de
// vocab_review_state, même forme FSRS — voir types/models.ts) ---

export async function getCultureReviewState(itemId: string): Promise<VocabReviewState | null> {
  const db = await getDB()
  const res = await db.query('SELECT * FROM cultureg_review_state WHERE item_id = ?', [itemId])
  const row = res.values?.[0]
  return row ? rowToVocabReviewState(row) : null
}

export async function upsertCultureReviewState(state: VocabReviewState): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO cultureg_review_state (item_id, lang, due_at, stability, difficulty, reps, lapses, last_grade, last_review, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       due_at = excluded.due_at, stability = excluded.stability, difficulty = excluded.difficulty,
       reps = excluded.reps, lapses = excluded.lapses, last_grade = excluded.last_grade,
       last_review = excluded.last_review, synced = excluded.synced`,
    [
      state.itemId, state.lang, state.dueAt, state.stability, state.difficulty,
      state.reps, state.lapses, state.lastGrade, state.lastReview, state.synced ? 1 : 0,
    ],
  )
}

export async function getDueCultureItems(lang: string, nowMs: number, limit = 20): Promise<VocabReviewState[]> {
  const db = await getDB()
  const res = await db.query(
    'SELECT * FROM cultureg_review_state WHERE lang = ? AND due_at <= ? ORDER BY RANDOM() LIMIT ?',
    [lang, nowMs, limit],
  )
  return (res.values ?? []).map(rowToVocabReviewState)
}

export async function countDueCultureItems(lang: string, nowMs: number): Promise<number> {
  const db = await getDB()
  const res = await db.query('SELECT count(*) AS n FROM cultureg_review_state WHERE lang = ? AND due_at <= ?', [lang, nowMs])
  return (res.values?.[0]?.n as number) ?? 0
}

export async function getCultureStats(lang: string): Promise<CultureStats> {
  const db = await getDB()
  const res = await db.query('SELECT * FROM cultureg_stats WHERE lang = ?', [lang])
  const row = res.values?.[0]
  return row ? { lang, correct: row.correct as number, total: row.total as number } : { lang, correct: 0, total: 0 }
}

export async function recordCultureAnswer(lang: string, correct: boolean): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO cultureg_stats (lang, correct, total) VALUES (?, ?, 1)
     ON CONFLICT(lang) DO UPDATE SET correct = correct + excluded.correct, total = total + 1`,
    [lang, correct ? 1 : 0],
  )
}

// --- mapping lignes SQLite (snake_case) -> types TS (camelCase) ---

function rowToVocabReviewState(row: Record<string, unknown>): VocabReviewState {
  return {
    itemId: row.item_id as string,
    lang: row.lang as string,
    dueAt: row.due_at as number,
    stability: row.stability as number,
    difficulty: row.difficulty as number,
    reps: row.reps as number,
    lapses: row.lapses as number,
    lastGrade: (row.last_grade as number | null) ?? null,
    lastReview: (row.last_review as number | null) ?? null,
    synced: Boolean(row.synced),
  }
}

// --- Phrases d'exercice (miroir local du cache serveur) ---

export interface StoredSentence {
  lemma: string
  tense: string
  person: string
  prompt: string
  promptFr: string
}

export function sentenceKey(lang: string, lemma: string, tense: string, person: string): string {
  return `${lang}:${lemma}:${tense}:${person}`
}

export async function getSentencesForLang(lang: string): Promise<StoredSentence[]> {
  const db = await getDB()
  const res = await db.query(
    'SELECT lemma, tense, person, prompt, prompt_fr FROM conjug_sentence WHERE lang = ?',
    [lang],
  )
  return (res.values ?? []).map((row) => ({
    lemma: row.lemma as string,
    tense: row.tense as string,
    person: row.person as string,
    prompt: row.prompt as string,
    promptFr: row.prompt_fr as string,
  }))
}

export async function saveSentences(lang: string, sentences: StoredSentence[]): Promise<void> {
  if (sentences.length === 0) return
  const db = await getDB()
  // executeSet : une seule transaction côté plugin, pour la même raison
  // qu'en tête de fichier — un run() par ligne ouvre sa propre transaction.
  await db.executeSet(
    sentences.map((s) => ({
      statement: `INSERT INTO conjug_sentence (key, lang, lemma, tense, person, prompt, prompt_fr)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(key) DO UPDATE SET prompt = excluded.prompt, prompt_fr = excluded.prompt_fr`,
      values: [sentenceKey(lang, s.lemma, s.tense, s.person), lang, s.lemma, s.tense, s.person, s.prompt, s.promptFr],
    })),
  )
}
