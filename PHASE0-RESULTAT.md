# Phase 0 — Résultat du spike transcripts

Voir `PLAN-PROJET.md` §8 pour le contexte et le critère de sortie d'origine, et `cmd/spike/` pour le binaire.

## Verdict final (24 flux testés)

| Langue | Flux exploitables | Critère (2/langue) |
|---|---|---|
| EN | Latino USA, The Moment with Jorge Ramos and Paola Ramos | ✅ atteint |
| ES | Radio Ambulante, El Hilo, Central | ✅ atteint |
| IT | Podcast Italiano Principiante (débutant, VTT, 218 segments/épisode) | ⚠️ 1/2 — voir décision ci-dessous |

Rapport complet généré par le binaire : `spike-report.txt`.

## Décision (validée par l'utilisateur le 2026-09-01)

Le critère strict « 2 flux exploitables par langue » n'est pas atteint pour l'italien (1/2). Conformément au §8 du plan (« si le critère n'est pas atteint, ne pas continuer tel quel, revenir vers moi »), la situation a été remontée. Décision prise : **on avance avec 1 seul flux italien**, parce que le risque réel identifié dans le document — trouver *au moins un* flux italien **débutant** exploitable, le point jugé le plus incertain — est résolu (Podcast Italiano Principiante, contenu A0 authentique, transcript SRT propre et vérifié manuellement).

Deux flux italiens (LearnAmo) et espagnols (Hoy Hablamos) sont restés en `http_403` (protection anti-bot) — jamais contournée, donc leur statut réel est inconnu, pas classé comme échec définitif.

Un faux positif a été détecté et exclu : le flux Spreaker « Easy Italian » expose bien une balise `podcast:transcript`, mais son contenu vérifié manuellement est une transcription automatique **en anglais** mal alignée sur de l'audio italien — inutilisable pour la révision.

**Conséquence pour la suite** : élargir le catalogue de flux italiens débutants n'est pas bloquant pour démarrer la Phase 1, mais reste une tâche de fond à traiter au fil de l'eau (le catalogue de flux n'est pas figé — l'ingester de la Phase 1 est fait pour absorber de nouveaux flux au fur et à mesure qu'on en trouve).
