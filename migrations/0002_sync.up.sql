-- Sauvegarde serveur des données utilisateur (§6.4 du plan) : le serveur
-- n'écrit jamais ces lignes de lui-même, il ne fait que les recevoir du
-- client (push) et les renvoyer (pull) après une réinstallation. Le client
-- reste la seule source de vérité pour l'état FSRS en cours d'usage normal.

CREATE TABLE capture (
    id           TEXT PRIMARY KEY,      -- UUID généré côté client
    segment_id   BIGINT NOT NULL REFERENCES segment(id) ON DELETE CASCADE,
    episode_id   BIGINT NOT NULL REFERENCES episode(id) ON DELETE CASCADE,
    captured_at  TIMESTAMPTZ NOT NULL,
    kind         TEXT NOT NULL,
    note         TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE review_state (
    segment_id   BIGINT PRIMARY KEY REFERENCES segment(id) ON DELETE CASCADE,
    due_at       TIMESTAMPTZ NOT NULL,
    stability    REAL NOT NULL,
    difficulty   REAL NOT NULL,
    reps         INT NOT NULL DEFAULT 0,
    lapses       INT NOT NULL DEFAULT 0,
    last_grade   INT,
    last_review  TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
