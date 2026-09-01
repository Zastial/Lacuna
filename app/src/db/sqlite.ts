import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_NAME = 'lacuna'

// Miroir local (§6.2 du plan) : episode/segment sont un cache lecture seule
// du contenu téléchargé, capture est la seule table écrite par l'app.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS episode (
  id INTEGER PRIMARY KEY,
  feed_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  audio_relative_path TEXT NOT NULL,
  duration_s INTEGER
);

CREATE TABLE IF NOT EXISTS segment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  UNIQUE(episode_id, idx)
);
CREATE INDEX IF NOT EXISTS segment_episode_start ON segment(episode_id, start_ms);

CREATE TABLE IF NOT EXISTS capture (
  id TEXT PRIMARY KEY,
  segment_id INTEGER NOT NULL,
  episode_id INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  synced INTEGER NOT NULL DEFAULT 0
);
`

const connection = new SQLiteConnection(CapacitorSQLite)
let db: SQLiteDBConnection | null = null

export async function getDB(): Promise<SQLiteDBConnection> {
  if (db) return db

  const { result: alreadyOpen } = await connection.isConnection(DB_NAME, false)
  db = alreadyOpen
    ? await connection.retrieveConnection(DB_NAME, false)
    : await connection.createConnection(DB_NAME, false, 'no-encryption', 1, false)

  await db.open()
  await db.execute(SCHEMA)
  return db
}
