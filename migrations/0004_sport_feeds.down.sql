DELETE FROM article_feed WHERE lang = 'fr';
ALTER TABLE article_feed DROP COLUMN sport;
ALTER TABLE article_feed DROP CONSTRAINT article_feed_lang_check;
ALTER TABLE article_feed ADD CONSTRAINT article_feed_lang_check CHECK (lang IN ('es', 'it'));
