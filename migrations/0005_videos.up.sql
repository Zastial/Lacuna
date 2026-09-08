-- Mode Vidéos : le contenu authentique passe du podcast à YouTube, choisi
-- par centre d'intérêt plutôt que par flux imposé.
--
-- Pas de table de segments ici, contrairement à episode/segment : YouTube ne
-- sert plus ses sous-titres sans paramètres signés extraits du lecteur
-- (endpoint timedtext vérifié — HTTP 200, corps vide). Il n'y a donc pas de
-- transcript aligné à stocker, et rien à découper en unités de révision.
CREATE TABLE video_channel (
    id                 BIGSERIAL PRIMARY KEY,
    youtube_channel_id TEXT NOT NULL UNIQUE,
    name               TEXT NOT NULL,
    lang               TEXT NOT NULL,
    category           TEXT NOT NULL,
    etag               TEXT,
    last_modified      TEXT,
    last_fetched_at    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT video_channel_lang_check CHECK (lang IN ('es', 'it'))
);

CREATE TABLE video (
    id               BIGSERIAL PRIMARY KEY,
    channel_id       BIGINT NOT NULL REFERENCES video_channel(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    thumbnail_url    TEXT NOT NULL DEFAULT '',
    published_at     TIMESTAMPTZ,
    UNIQUE (channel_id, youtube_video_id)
);
CREATE INDEX video_published_idx ON video (published_at DESC NULLS LAST);
