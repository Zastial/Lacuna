-- Mode Articles : chaque jour, quelques articles récents en italien/espagnol
-- issus de grands médias, pour lire plutôt qu'écouter. Même esprit que
-- feed/episode (§6.1) mais pour du texte : pas de segments, pas de transcript.
CREATE TABLE article_feed (
    id              BIGSERIAL PRIMARY KEY,
    rss_url         TEXT NOT NULL UNIQUE,
    source_name     TEXT NOT NULL,
    lang            TEXT NOT NULL,
    etag            TEXT,
    last_modified   TEXT,
    last_fetched_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT article_feed_lang_check CHECK (lang IN ('es', 'it'))
);

CREATE TABLE article (
    id           BIGSERIAL PRIMARY KEY,
    feed_id      BIGINT NOT NULL REFERENCES article_feed(id) ON DELETE CASCADE,
    guid         TEXT NOT NULL,
    title        TEXT NOT NULL,
    summary      TEXT NOT NULL,
    url          TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    rare_ratio   REAL,
    UNIQUE (feed_id, guid)
);
CREATE INDEX article_feed_published_idx ON article (feed_id, published_at DESC);
