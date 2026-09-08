# Lacuna

> *lacuna* — le trou dans la compréhension. Et l'unité de base du produit.

Une app mobile pour apprendre l'italien et l'espagnol, construite autour d'une
idée simple : **ce que je ne comprends pas devient mon programme de révision.**

---

## Pourquoi cette app existe

Quand j'écoute un podcast en espagnol et que je décroche sur quatre secondes,
cette information est perdue. Je continue, j'oublie, et je redécroche au même
endroit le lendemain.

Lacuna instrumente ce moment précis. Un bouton, un timestamp, et le segment
audio *avec sa phrase transcrite* entre dans une file de révision espacée.

L'unité de révision n'est pas le mot, c'est **le segment audio + sa
transcription**. C'est la décision de design centrale : on peut connaître
`sciopero` sur une carte et ne pas l'entendre passer dans un flux de parole.
Tout le modèle de données en découle.

Aucun outil existant ne ferme cette boucle — écoute réelle → échec capturé →
révision de ce segment précis → réécoute plus tard. Anki a un excellent SRS
mais tout l'encodage est manuel et rien n'est pensé pour l'audio. LingQ est
centré texte. Duolingo produit des phrases hors contexte. Pimsleur est un
programme fermé, non personnalisé.

## Les partis pris

**Pas d'IA générative.** Aucun appel à un LLM, aucune clé d'API, aucun coût
récurrent. Les exercices sont soit écrits à la main, soit dérivés par des
règles vérifiables. La conjugaison, par exemple, vient d'un moteur de règles
(`-are`/`-ere`/`-ire`, `-ar`/`-er`/`-ir`, plus les irrégularités listées
explicitement) contrôlé contre le dataset UniMorph : 900 formes confrontées,
zéro écart. Le seul modèle utilisé est celui d'Apple pour la traduction, et il
tourne **sur l'appareil**, hors ligne.

**Hors ligne d'abord.** Les épisodes se téléchargent, la base est locale
(SQLite), la révision fonctionne dans le métro. La synchronisation avec le
serveur est un filet de sécurité, pas une dépendance.

**Jamais d'écoute passive.** Toute fonctionnalité qui laisse écouter longtemps
sans rien faire est un anti-pattern ici. Le rappel actif est partout.

## Ce qu'il y a dedans

| Mode | Ce que ça fait |
|---|---|
| **Transport** | Lecture audio avec sous-titres alignés, et le bouton de capture |
| **Fondations** | Scénarios écrits à la main + exercices de conjugaison générés |
| **Réviser** | La file d'attente des segments capturés, ordonnée par FSRS |
| **Culture G** | Questions de culture générale dans la langue cible, expliquées en français |
| **Articles** | Presse quotidienne (ANSA, la Repubblica, BBC Mundo, Infobae) avec les mots rares mis en évidence |
| **Sport** | Les titres de L'Équipe, filtrés sur tes sports, à redire en langue cible |

Et une notification quotidienne bilingue : la phrase du jour, le rappel de
révision, et — sur appareil réel — un titre sportif traduit hors ligne.

### Le mode Sport, ou pourquoi traduire depuis le français

Les autres modes vont de la langue cible vers le français. Celui-ci fait
l'inverse, et c'est délibéré : L'Équipe publie en français, donc le sens est
déjà acquis. Ce qui reste à apprendre, c'est **la façon de le dire**. La
détection de langue (`NLLanguageRecognizer`) vérifie que la source est bien
dans ta langue avant de traduire — un titre déjà en italien ne gagnerait rien
au passage.

## Architecture

```
cmd/ingester      Récupération RSS, découpage des transcripts, ingestion articles
internal/         Parsing de flux, alignement, API JSON, sync
migrations/       Schéma Postgres (golang-migrate, embarqué dans le binaire)
app/              Client Vue 3 + Capacitor (iOS)
  src/data/       Contenu écrit à la main : scénarios, verbes, culture G
  src/services/   Conjugaison, FSRS, fréquence lexicale, traduction native
  src/db/         SQLite local
  ios/App/        Plugin Swift de traduction sur appareil
```

Le backend est en Go (Postgres + Redis, `docker compose up`). Le client est en
Vue 3 / TypeScript, empaqueté par Capacitor. La répétition espacée utilise
FSRS via `ts-fsrs`, sur trois files indépendantes (segments audio,
conjugaison, culture G).

## Démarrer

```bash
docker compose up -d          # Postgres, Redis, API sur :8080
go run ./cmd/ingester         # peupler les flux et les articles
cd app && npm install && npm run dev
```

Pour l'app iOS : `npm run build && npx cap sync ios`, puis ouvrir
`app/ios/App/App.xcodeproj` dans Xcode.

## Limites connues, mesurées

- **La traduction Apple ne marche pas dans le Simulateur.** Le framework se
  charge et liste bien `fr`, `it`, `es`, mais toutes les paires renvoient
  `unsupported` : les modèles n'existent pas sur simulateur. Vérifiable
  uniquement sur appareil réel. La détection de langue, elle, marche partout.
- **iOS ne laisse aucune app lire les notifications des autres.** Pas
  d'équivalent au `NotificationListenerService` d'Android. Lacuna ne peut donc
  traduire que ses propres notifications.
- **Certains podcasts insèrent de la publicité dynamiquement**, ce qui décale
  l'audio réel par rapport au transcript (constaté : +12 à 14 min sur 2
  épisodes testés sur 5). L'app détecte l'écart et prévient plutôt que
  d'afficher des sous-titres faux.
- **UniMorph ne peut pas servir de source de conjugaison** : le dataset
  italien n'a ni `essere`, ni `avere`, ni `potere`, et omet le présent
  irrégulier des verbes courants. Il ne sert que de vérificateur.

## Contexte

Projet personnel, utilisateur unique. Le cadrage complet — thèse produit,
fondements pédagogiques, contraintes de distribution iOS — est dans
[PLAN-PROJET.md](PLAN-PROJET.md).
