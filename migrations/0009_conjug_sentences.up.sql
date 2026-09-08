-- Phrases d'exercice contextualisées, une par forme conjuguée.
--
-- Les exercices générés côté client n'affichaient qu'un « io ___ » nu : sans
-- contexte ni traduction, on choisit une terminaison sans savoir ce qu'on
-- dit. Seules quelques formes écrites à la main faisaient exception.
--
-- La génération est paresseuse et le résultat définitif : une phrase produite
-- une fois est resservie à jamais. C'est ce qui rend le coût négligeable et
-- l'usage hors ligne possible une fois le cache local rempli.
CREATE TABLE conjug_sentence (
    lang      TEXT NOT NULL,
    lemma     TEXT NOT NULL,
    tense     TEXT NOT NULL,
    person    TEXT NOT NULL,
    prompt    TEXT NOT NULL,
    prompt_fr TEXT NOT NULL,
    form      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (lang, lemma, tense, person)
);
