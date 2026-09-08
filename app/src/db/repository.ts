import { getDB } from './sqlite'
import type { Capture, CultureStats, DueReviewItem, LocalEpisode, LocalSegment, ReviewState, VocabReviewState } from '../types/models'

export async function saveEpisode(episode: LocalEpisode): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO episode (id, feed_id, title, audio_relative_path, duration_s, lang, level)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       feed_id = excluded.feed_id, title = excluded.title,
       audio_relative_path = excluded.audio_relative_path, duration_s = excluded.duration_s,
       lang = excluded.lang, level = excluded.level`,
    [episode.id, episode.feedId, episode.title, episode.audioRelativePath, episode.durationS, episode.lang, episode.level],
  )
}

const UPSERT_SEGMENT_SQL = `
  INSERT INTO segment (episode_id, idx, start_ms, end_ms, text)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(episode_id, idx) DO UPDATE SET
    start_ms = excluded.start_ms, end_ms = excluded.end_ms, text = excluded.text`

// executeSet exécute le lot en une seule transaction atomique côté plugin —
// un simple run() par ligne se met déjà en transaction individuellement
// (comportement par défaut du plugin), ce qui interdit un BEGIN manuel autour.
export async function saveSegments(episodeId: number, segments: LocalSegment[]): Promise<void> {
  const db = await getDB()
  await db.executeSet(
    segments.map((s) => ({
      statement: UPSERT_SEGMENT_SQL,
      values: [episodeId, s.idx, s.startMs, s.endMs, s.text],
    })),
  )
}

export async function getDownloadedEpisodes(): Promise<LocalEpisode[]> {
  const db = await getDB()
  const res = await db.query(
    'SELECT id, feed_id, title, audio_relative_path, duration_s, lang, level FROM episode ORDER BY id DESC',
  )
  return (res.values ?? []).map(rowToEpisode)
}

export async function getEpisode(id: number): Promise<LocalEpisode | null> {
  const db = await getDB()
  const res = await db.query(
    'SELECT id, feed_id, title, audio_relative_path, duration_s, lang, level FROM episode WHERE id = ?',
    [id],
  )
  const row = res.values?.[0]
  return row ? rowToEpisode(row) : null
}

export async function getSegments(episodeId: number): Promise<LocalSegment[]> {
  const db = await getDB()
  const res = await db.query(
    'SELECT id, episode_id, idx, start_ms, end_ms, text FROM segment WHERE episode_id = ? ORDER BY idx',
    [episodeId],
  )
  return (res.values ?? []).map(rowToSegment)
}

// findSegmentAt résout le segment couvrant un timestamp donné (ms depuis le
// début de l'épisode) — c'est le cœur de la capture en mode TRANSPORT (§7) :
// un tap enregistre le timestamp courant, on retrouve le segment associé.
export async function findSegmentAt(episodeId: number, timestampMs: number): Promise<LocalSegment | null> {
  const db = await getDB()
  const res = await db.query(
    `SELECT id, episode_id, idx, start_ms, end_ms, text FROM segment
     WHERE episode_id = ? AND start_ms <= ?
     ORDER BY start_ms DESC LIMIT 1`,
    [episodeId, timestampMs],
  )
  const row = res.values?.[0]
  return row ? rowToSegment(row) : null
}

// deleteEpisode retire l'épisode et tout ce qui en dépend (segments,
// captures, état de révision). Renvoie le chemin audio relatif pour que
// l'appelant supprime aussi le fichier du Filesystem.
export async function deleteEpisode(episodeId: number): Promise<string | null> {
  const db = await getDB()
  const episode = await getEpisode(episodeId)
  if (!episode) return null

  // Un BEGIN manuel autour de run() échouait avec « cannot start a
  // transaction within a transaction » : run() ouvre déjà sa propre
  // transaction (3e paramètre à true par défaut). executeSet groupe les
  // quatre suppressions dans une seule transaction côté plugin, ce qui
  // garde l'atomicité sans imbrication — même raison qu'en tête de fichier.
  // L'ordre va des dépendances vers le parent.
  await db.executeSet([
    {
      statement: 'DELETE FROM review_state WHERE segment_id IN (SELECT id FROM segment WHERE episode_id = ?)',
      values: [episodeId],
    },
    { statement: 'DELETE FROM capture WHERE episode_id = ?', values: [episodeId] },
    { statement: 'DELETE FROM segment WHERE episode_id = ?', values: [episodeId] },
    { statement: 'DELETE FROM episode WHERE id = ?', values: [episodeId] },
  ])

  return episode.audioRelativePath
}

// ON CONFLICT DO NOTHING : une capture est immuable une fois créée, et ça
// rend l'insertion idempotente pour le pull de restauration (§6.4) sans
// avoir à vérifier l'existence au préalable.
export async function insertCapture(capture: Capture): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO capture (id, segment_id, episode_id, captured_at, kind, note, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [capture.id, capture.segmentId, capture.episodeId, capture.capturedAt, capture.kind, capture.note, capture.synced ? 1 : 0],
  )
}

export async function listCaptures(episodeId?: number): Promise<Capture[]> {
  const db = await getDB()
  const res = episodeId === undefined
    ? await db.query('SELECT * FROM capture ORDER BY captured_at DESC')
    : await db.query('SELECT * FROM capture WHERE episode_id = ? ORDER BY captured_at DESC', [episodeId])
  return (res.values ?? []).map(rowToCapture)
}

export async function getUnsyncedCaptures(): Promise<Capture[]> {
  const db = await getDB()
  const res = await db.query('SELECT * FROM capture WHERE synced = 0')
  return (res.values ?? []).map(rowToCapture)
}

export async function markCapturesSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getDB()
  await db.executeSet(
    ids.map((id) => ({ statement: 'UPDATE capture SET synced = 1 WHERE id = ?', values: [id] })),
  )
}

// --- review_state (§7 mode REVUE, FSRS) ---

// upsertReviewStateIfMissing sert au pull de restauration (§6.4) : le
// device actif reste la source de vérité tant qu'il a un état local, on ne
// restaure depuis le serveur que ce qui manque (segment jamais revu depuis
// la réinstallation).
export async function upsertReviewStateIfMissing(state: ReviewState): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO review_state (segment_id, due_at, stability, difficulty, reps, lapses, last_grade, last_review, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(segment_id) DO NOTHING`,
    [
      state.segmentId, state.dueAt, state.stability, state.difficulty,
      state.reps, state.lapses, state.lastGrade, state.lastReview, 1, // déjà sur le serveur
    ],
  )
}

export async function getReviewState(segmentId: number): Promise<ReviewState | null> {
  const db = await getDB()
  const res = await db.query('SELECT * FROM review_state WHERE segment_id = ?', [segmentId])
  const row = res.values?.[0]
  return row ? rowToReviewState(row) : null
}

export async function upsertReviewState(state: ReviewState): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO review_state (segment_id, due_at, stability, difficulty, reps, lapses, last_grade, last_review, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(segment_id) DO UPDATE SET
       due_at = excluded.due_at, stability = excluded.stability, difficulty = excluded.difficulty,
       reps = excluded.reps, lapses = excluded.lapses, last_grade = excluded.last_grade,
       last_review = excluded.last_review, synced = excluded.synced`,
    [
      state.segmentId, state.dueAt, state.stability, state.difficulty,
      state.reps, state.lapses, state.lastGrade, state.lastReview, state.synced ? 1 : 0,
    ],
  )
}

// getDueReviewItems renvoie les segments dus (due_at <= now), avec le
// contexte nécessaire à l'affichage, triés par échéance — la file de
// révision du soir (§7).
export async function getDueReviewItems(nowMs: number, limit = 50): Promise<DueReviewItem[]> {
  const db = await getDB()
  const res = await db.query(
    `SELECT
       s.id AS s_id, s.episode_id AS s_episode_id, s.idx AS s_idx,
       s.start_ms AS s_start_ms, s.end_ms AS s_end_ms, s.text AS s_text,
       r.segment_id, r.due_at, r.stability, r.difficulty, r.reps, r.lapses,
       r.last_grade, r.last_review, r.synced,
       e.title AS episode_title, e.audio_relative_path, e.lang, e.level
     FROM review_state r
     JOIN segment s ON s.id = r.segment_id
     JOIN episode e ON e.id = s.episode_id
     WHERE r.due_at <= ?
     ORDER BY r.due_at ASC
     LIMIT ?`,
    [nowMs, limit],
  )
  return (res.values ?? []).map((row) => ({
    segment: {
      id: row.s_id as number,
      episodeId: row.s_episode_id as number,
      idx: row.s_idx as number,
      startMs: row.s_start_ms as number,
      endMs: row.s_end_ms as number,
      text: row.s_text as string,
    },
    reviewState: rowToReviewState(row),
    episodeId: row.s_episode_id as number,
    episodeTitle: row.episode_title as string,
    audioRelativePath: row.audio_relative_path as string,
    lang: row.lang as string,
    level: row.level as string,
  }))
}

// Les mêmes jointures que getDueReviewItems, délibérément : sans elles, le
// compteur voyait des review_state orphelins — dont le segment ou l'épisode
// a été supprimé — que la liste, elle, écartait. La pastille annonçait « 1 »
// et l'écran de révision s'ouvrait vide. Le compte doit porter sur exactement
// ce que la file sait afficher.
export async function countDueReviewItems(nowMs: number): Promise<number> {
  const db = await getDB()
  const res = await db.query(
    `SELECT count(*) AS n
     FROM review_state r
     JOIN segment s ON s.id = r.segment_id
     JOIN episode e ON e.id = s.episode_id
     WHERE r.due_at <= ?`,
    [nowMs],
  )
  return (res.values?.[0]?.n as number) ?? 0
}

// getAdjacentSegments renvoie le segment juste avant et juste après idx dans
// le même épisode — le contexte demandé par §7 ("segment précédent et suivant").
export async function getAdjacentSegments(episodeId: number, idx: number): Promise<{ prev: LocalSegment | null; next: LocalSegment | null }> {
  const db = await getDB()
  const prevRes = await db.query(
    'SELECT id, episode_id, idx, start_ms, end_ms, text FROM segment WHERE episode_id = ? AND idx = ?',
    [episodeId, idx - 1],
  )
  const nextRes = await db.query(
    'SELECT id, episode_id, idx, start_ms, end_ms, text FROM segment WHERE episode_id = ? AND idx = ?',
    [episodeId, idx + 1],
  )
  return {
    prev: prevRes.values?.[0] ? rowToSegment(prevRes.values[0]) : null,
    next: nextRes.values?.[0] ? rowToSegment(nextRes.values[0]) : null,
  }
}

export async function getUnsyncedReviewStates(): Promise<ReviewState[]> {
  const db = await getDB()
  const res = await db.query('SELECT * FROM review_state WHERE synced = 0')
  return (res.values ?? []).map(rowToReviewState)
}

export async function markReviewStatesSynced(segmentIds: number[]): Promise<void> {
  if (segmentIds.length === 0) return
  const db = await getDB()
  await db.executeSet(
    segmentIds.map((id) => ({ statement: 'UPDATE review_state SET synced = 1 WHERE segment_id = ?', values: [id] })),
  )
}

// --- FONDATIONS : révision espacée du vocabulaire/conjugaison, et
// progression des scénarios (indépendants de tout épisode audio) ---

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

function rowToEpisode(row: Record<string, unknown>): LocalEpisode {
  return {
    id: row.id as number,
    feedId: row.feed_id as number,
    title: row.title as string,
    audioRelativePath: row.audio_relative_path as string,
    durationS: (row.duration_s as number | null) ?? null,
    lang: (row.lang as string) ?? '',
    level: (row.level as string) ?? '',
  }
}

function rowToSegment(row: Record<string, unknown>): LocalSegment {
  return {
    id: row.id as number,
    episodeId: row.episode_id as number,
    idx: row.idx as number,
    startMs: row.start_ms as number,
    endMs: row.end_ms as number,
    text: row.text as string,
  }
}

function rowToCapture(row: Record<string, unknown>): Capture {
  return {
    id: row.id as string,
    segmentId: row.segment_id as number,
    episodeId: row.episode_id as number,
    capturedAt: row.captured_at as number,
    kind: row.kind as Capture['kind'],
    note: (row.note as string | null) ?? null,
    synced: Boolean(row.synced),
  }
}

function rowToReviewState(row: Record<string, unknown>): ReviewState {
  return {
    segmentId: row.segment_id as number,
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
