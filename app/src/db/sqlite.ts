import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_NAME = 'lacuna'

// Base locale : progression et files de révision espacée. Tout le contenu
// (vidéos, articles) vient du réseau et n'est pas mis en cache ici.
const SCHEMA = `
-- Révision espacée du mode Fondations : item_id est l'id stable d'un
-- ConjugItem, écrit à la main ou généré.
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

-- Miroir local des phrases d'exercice générées côté serveur. Recopiées ici
-- pour que les leçons et les révisions fonctionnent sans réseau une fois la
-- première visite faite.
CREATE TABLE IF NOT EXISTS conjug_sentence (
  key        TEXT PRIMARY KEY,
  lang       TEXT NOT NULL,
  lemma      TEXT NOT NULL,
  tense      TEXT NOT NULL,
  person     TEXT NOT NULL,
  prompt     TEXT NOT NULL,
  prompt_fr  TEXT NOT NULL
);

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

// migrate rattrape les bases créées par une version antérieure. Ici : le
// mode audio a été retiré, et ses tables locales n'ont plus ni producteur ni
// lecteur. Les laisser garderait des captures orphelines et de l'audio
// référencé dans une base qu'on croit propre.
//
// L'ordre part des feuilles : review_state et capture référencent segment,
// qui référence episode.
async function migrate(db: SQLiteDBConnection): Promise<void> {
  for (const table of ['review_state', 'capture', 'segment', 'episode']) {
    await db.execute(`DROP TABLE IF EXISTS ${table}`)
  }
}
