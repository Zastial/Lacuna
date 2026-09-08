-- Flux d'actualité sportive en français (L'Équipe). Le français entre ici
-- comme langue SOURCE : l'utilisateur lit un titre dont il comprend déjà le
-- sens, et l'app en propose la version en langue cible — c'est la traduction
-- qui porte l'apprentissage, pas le titre lui-même.
ALTER TABLE article_feed DROP CONSTRAINT article_feed_lang_check;
ALTER TABLE article_feed ADD CONSTRAINT article_feed_lang_check CHECK (lang IN ('es', 'it', 'fr'));

-- NULL pour les flux généralistes, nom du sport pour les flux dédiés.
ALTER TABLE article_feed ADD COLUMN sport TEXT;
