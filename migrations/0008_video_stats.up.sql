-- Vues et likes par vidéo, servis par le flux Atom lui-même
-- (media:statistics et media:starRating) — toujours sans clé d'API.
--
-- Ils remplacent la date comme critère de classement : le flux ne contient
-- que les 15 dernières vidéos de chaque chaîne, donc trier par popularité
-- à l'intérieur de ce vivier revient à proposer « le meilleur de ce qui est
-- récent » plutôt que « le plus récent, quel qu'il soit ».
ALTER TABLE video ADD COLUMN views BIGINT NOT NULL DEFAULT 0;
ALTER TABLE video ADD COLUMN likes BIGINT NOT NULL DEFAULT 0;

CREATE INDEX video_views_idx ON video (views DESC);
