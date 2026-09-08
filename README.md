# Lacuna

> *lacuna* — le trou dans la compréhension. Et l'unité de base du produit.

Une app mobile pour apprendre l'italien et l'espagnol, construite autour d'une
idée simple : **ce que je ne comprends pas devient mon programme de révision.**

---

## Pourquoi cette app existe

On abandonne une langue parce que le contenu est ennuyeux. Les phrases
d'application ne parlent de rien, et le contenu « authentique » proposé est
rarement celui qu'on aurait regardé de toute façon.

Lacuna part de l'inverse : tu dis ce qui t'intéresse — sport, musique,
informatique — et l'app va chercher des vidéos récentes sur ces sujets, en
italien ou en espagnol. À côté, des exercices écrits à la main et une
révision espacée qui te ramène ce que tu es sur le point d'oublier.

Anki a un excellent SRS mais tout l'encodage est manuel. LingQ est centré
texte. Duolingo produit des phrases hors contexte. Pimsleur est un programme
fermé, non personnalisé.

> **Note historique.** Le projet est né d'une autre thèse : capturer les
> moments où l'on décroche en écoutant un podcast, et réviser ce segment
> précis avec sa transcription. Cette boucle a été construite, puis retirée
> au profit de la vidéo. La raison est mesurée, pas idéologique : YouTube ne
> sert plus ses sous-titres aux clients tiers, donc il n'y a plus de texte
> aligné à réviser. Le cadrage d'origine reste dans
> [PLAN-PROJET.md](PLAN-PROJET.md).

## Les partis pris

**Pas d'IA générative.** Aucun appel à un LLM, aucune clé d'API, aucun coût
récurrent. Les exercices sont soit écrits à la main, soit dérivés par des
règles vérifiables. La conjugaison, par exemple, vient d'un moteur de règles
(`-are`/`-ere`/`-ire`, `-ar`/`-er`/`-ir`, plus les irrégularités listées
explicitement) contrôlé contre le dataset UniMorph : 900 formes confrontées,
zéro écart. Le seul modèle utilisé est celui d'Apple pour la traduction, et il
tourne **sur l'appareil**, hors ligne.

**Local d'abord.** La base est locale (SQLite) : les exercices, la
progression et la révision espacée fonctionnent sans réseau. Seules les
vidéos et les articles, par nature, demandent une connexion.

**Jamais d'écoute passive.** Toute fonctionnalité qui laisse écouter longtemps
sans rien faire est un anti-pattern ici. Le rappel actif est partout.

## Ce qu'il y a dedans

| Mode | Ce que ça fait |
|---|---|
| **À regarder** | Des vidéos YouTube récentes en IT/ES, filtrées sur tes centres d'intérêt |
| **Fondations** | Scénarios écrits à la main + exercices de conjugaison générés |
| **Culture G** | Questions de culture générale dans la langue cible, expliquées en français |
| **Articles** | Presse quotidienne (ANSA, la Repubblica, BBC Mundo, Infobae) avec les mots rares mis en évidence |
| **Sport** | Les titres de L'Équipe, filtrés sur tes sports, à redire en langue cible |
| **Onboarding** | Au premier lancement : langue et centres d'intérêt |

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
cmd/ingester      Chaînes YouTube, flux d'articles, listes de fréquence
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
go run ./cmd/ingester         # peupler chaînes, vidéos et articles
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
- **YouTube ne sert plus ses sous-titres aux clients tiers.** L'endpoint
  `timedtext` répond HTTP 200 avec un corps vide : les paramètres signés
  doivent être extraits du lecteur. C'est ce constat qui a fait renoncer à
  toute révision dérivée d'une vidéo.
- **Les flux de chaîne YouTube ne demandent aucune clé d'API** et servent les
  15 dernières vidéos. C'est ce qui rend le mode vidéo gratuit et sans quota.
- **UniMorph ne peut pas servir de source de conjugaison** : le dataset
  italien n'a ni `essere`, ni `avere`, ni `potere`, et omet le présent
  irrégulier des verbes courants. Il ne sert que de vérificateur.

## Contexte

Projet personnel, utilisateur unique. Le cadrage complet — thèse produit,
fondements pédagogiques, contraintes de distribution iOS — est dans
[PLAN-PROJET.md](PLAN-PROJET.md).
