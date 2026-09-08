-- La table prompt avait été créée d'avance pour un « mode salle » (Phase 4 du
-- plan) qui n'a jamais été construit. Aucun code ne l'écrit ni ne la lit, et
-- le cadrage dont elle venait a depuis été remplacé. Une table vide que rien
-- ne référence coûte plus en confusion qu'elle ne fait gagner de temps le
-- jour où la fonctionnalité reviendrait.
DROP TABLE IF EXISTS prompt;
