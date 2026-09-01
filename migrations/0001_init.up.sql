CREATE TABLE feed (
    id              BIGSERIAL PRIMARY KEY,
    rss_url         TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    lang            TEXT NOT NULL,
    level           TEXT NOT NULL,
    has_transcripts BOOLEAN NOT NULL DEFAULT FALSE,
    etag            TEXT,
    last_modified   TEXT,
    last_fetched_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT feed_lang_check CHECK (lang IN ('en', 'es', 'it')),
    CONSTRAINT feed_level_check CHECK (level IN ('beginner', 'intermediate', 'native'))
);

CREATE TABLE episode (
    id              BIGSERIAL PRIMARY KEY,
    feed_id         BIGINT NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
    guid            TEXT NOT NULL,
    title           TEXT NOT NULL,
    audio_url       TEXT NOT NULL,
    duration_s      INT,
    published_at    TIMESTAMPTZ,
    transcript_url  TEXT,
    transcript_type TEXT,
    segments_ready  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (feed_id, guid),
    CONSTRAINT episode_transcript_type_check CHECK (transcript_type IS NULL OR transcript_type IN ('vtt', 'srt', 'json'))
);

-- Unité centrale du produit.
CREATE TABLE segment (
    id          BIGSERIAL PRIMARY KEY,
    episode_id  BIGINT NOT NULL REFERENCES episode(id) ON DELETE CASCADE,
    idx         INT NOT NULL,
    start_ms    INT NOT NULL,
    end_ms      INT NOT NULL,
    text        TEXT NOT NULL,
    speaker     TEXT,
    word_count  INT NOT NULL,
    rare_ratio  REAL,
    UNIQUE (episode_id, idx)
);
CREATE INDEX segment_episode_start_idx ON segment (episode_id, start_ms);

-- Listes de fréquence (OpenSubtitles / Tatoeba), pour le calcul de difficulté et les cloze.
CREATE TABLE frequency_word (
    lang TEXT NOT NULL,
    word TEXT NOT NULL,
    rank INT NOT NULL,
    PRIMARY KEY (lang, word)
);

-- Banque de questions du mode salle (Phase 4). Créée maintenant pour que le
-- schéma soit stable, mais non alimentée avant la Phase 4.
CREATE TABLE prompt (
    id           BIGSERIAL PRIMARY KEY,
    lang         TEXT NOT NULL,
    context      TEXT NOT NULL,
    level        TEXT NOT NULL,
    question     TEXT NOT NULL,
    answer_mode  TEXT NOT NULL,
    choices      JSONB,
    model_answer TEXT,
    CONSTRAINT prompt_answer_mode_check CHECK (answer_mode IN ('choice', 'speak', 'text'))
);
