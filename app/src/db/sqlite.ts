import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_NAME = 'lacuna'

// Miroir local (§6.2 du plan) : episode/segment sont un cache lecture seule
// du contenu téléchargé, capture et review_state sont écrites par l'app.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS episode (
  id INTEGER PRIMARY KEY,
  feed_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  audio_relative_path TEXT NOT NULL,
  duration_s INTEGER,
  lang TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT ''
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

-- Un segment capturé au moins une fois entre en révision (§7 mode REVUE).
CREATE TABLE IF NOT EXISTS review_state (
  segment_id  INTEGER PRIMARY KEY,
  due_at      INTEGER NOT NULL,
  stability   REAL NOT NULL,
  difficulty  REAL NOT NULL,
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  last_grade  INTEGER,
  last_review INTEGER,
  synced      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS review_state_due ON review_state(due_at);

-- Révision espacée pour le mode FONDATIONS (§ vocabulaire/conjugaison) :
-- même structure que review_state mais itemId n'est pas un segment audio,
-- c'est l'id stable d'un ConjugItem ou "vocab:<lang>:<target>".
CREATE TABLE IF NOT EXISTS vocab_review_state (
  item_id     TEXT PRIMARY KEY,
  lang        TEXT NOT NULL,
  due_at      INTEGER NOT NULL,
  stability   REAL NOT NULL,
  difficulty  REAL NOT NULL,
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  last_grade  INTEGER,
  last_review INTEGER,
  synced      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS vocab_review_state_due ON vocab_review_state(lang, due_at);

CREATE TABLE IF NOT EXISTS fondations_progress (
  scenario_id  TEXT PRIMARY KEY,
  completed_at INTEGER NOT NULL
);

-- Mode Culture G : file de révision dédiée (même forme FSRS que
-- vocab_review_state, table séparée pour ne jamais mélanger les deux
-- files) + score cumulé par langue.
CREATE TABLE IF NOT EXISTS cultureg_review_state (
  item_id     TEXT PRIMARY KEY,
  lang        TEXT NOT NULL,
  due_at      INTEGER NOT NULL,
  stability   REAL NOT NULL,
  difficulty  REAL NOT NULL,
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  last_grade  INTEGER,
  last_review INTEGER,
  synced      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS cultureg_review_state_due ON cultureg_review_state(lang, due_at);

CREATE TABLE IF NOT EXISTS cultureg_stats (
  lang    TEXT PRIMARY KEY,
  correct INTEGER NOT NULL DEFAULT 0,
  total   INTEGER NOT NULL DEFAULT 0
);
`

const connection = new SQLiteConnection(CapacitorSQLite)
let db: SQLiteDBConnection | null = null
// Plusieurs stores appellent getDB() en parallèle au montage de l'app
// (revue/fondations/cultureg s'initialisent tous dans le même onMounted) —
// sans ce cache de la promesse en cours, chacun verrait `db` encore null et
// tenterait sa propre createConnection() sur le même nom, d'où
// "Connection lacuna already exists" côté plugin natif.
let dbPromise: Promise<SQLiteDBConnection> | null = null

export async function getDB(): Promise<SQLiteDBConnection> {
  if (db) return db
  if (!dbPromise) {
    dbPromise = (async () => {
      const { result: alreadyOpen } = await connection.isConnection(DB_NAME, false)
      const conn = alreadyOpen
        ? await connection.retrieveConnection(DB_NAME, false)
        : await connection.createConnection(DB_NAME, false, 'no-encryption', 1, false)

      await conn.open()
      await conn.execute(SCHEMA)
      await migrate(conn)
      db = conn
      return conn
    })()
  }
  return dbPromise
}

// migrate applique les changements de schéma sur une base déjà créée par une
// version antérieure de l'app (pas de framework de migration : le schéma est
// encore petit, CREATE TABLE IF NOT EXISTS + ALTER TABLE best-effort suffit).
async function migrate(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, 'episode', 'lang', "TEXT NOT NULL DEFAULT ''")
  await addColumnIfMissing(db, 'episode', 'level', "TEXT NOT NULL DEFAULT ''")
}

async function addColumnIfMissing(db: SQLiteDBConnection, table: string, column: string, definition: string): Promise<void> {
  const res = await db.query(`PRAGMA table_info(${table})`)
  const exists = (res.values ?? []).some((row) => (row as { name?: string }).name === column)
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}
