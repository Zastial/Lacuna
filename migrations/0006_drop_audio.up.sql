-- Retrait du pipeline podcast : l'app ne lit plus d'audio, et YouTube ne sert
-- plus de transcript alignable (endpoint timedtext vérifié, corps vide).
-- Segments, captures et état de révision associé n'ont donc plus ni
-- producteur ni consommateur.
--
-- Suppression depuis les feuilles : review_state et capture référencent
-- segment, qui référence episode, qui référence feed.
DROP TABLE IF EXISTS review_state;
DROP TABLE IF EXISTS capture;
DROP TABLE IF EXISTS segment;
DROP TABLE IF EXISTS episode;
DROP TABLE IF EXISTS feed;
