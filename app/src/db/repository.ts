import { getDB } from './sqlite'
import type { Capture, LocalEpisode, LocalSegment } from '../types/models'

export async function saveEpisode(episode: LocalEpisode): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO episode (id, feed_id, title, audio_relative_path, duration_s)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       feed_id = excluded.feed_id, title = excluded.title,
       audio_relative_path = excluded.audio_relative_path, duration_s = excluded.duration_s`,
    [episode.id, episode.feedId, episode.title, episode.audioRelativePath, episode.durationS],
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
  const res = await db.query('SELECT id, feed_id, title, audio_relative_path, duration_s FROM episode ORDER BY id DESC')
  return (res.values ?? []).map(rowToEpisode)
}

export async function getEpisode(id: number): Promise<LocalEpisode | null> {
  const db = await getDB()
  const res = await db.query('SELECT id, feed_id, title, audio_relative_path, duration_s FROM episode WHERE id = ?', [id])
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

export async function insertCapture(capture: Capture): Promise<void> {
  const db = await getDB()
  await db.run(
    `INSERT INTO capture (id, segment_id, episode_id, captured_at, kind, note, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

// --- mapping lignes SQLite (snake_case) -> types TS (camelCase) ---

function rowToEpisode(row: Record<string, unknown>): LocalEpisode {
  return {
    id: row.id as number,
    feedId: row.feed_id as number,
    title: row.title as string,
    audioRelativePath: row.audio_relative_path as string,
    durationS: (row.duration_s as number | null) ?? null,
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
