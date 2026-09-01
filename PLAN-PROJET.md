# Lacuna — Application mobile d'apprentissage des langues par capture d'échecs d'écoute

> Nom du projet : **Lacuna**. Le trou dans la compréhension — et l'unité de base du produit.
> Cognat dans les trois langues cibles : *lacuna* (EN, IT), *laguna* (ES).

> Document de cadrage destiné à Claude Code. À placer à la racine du repo.
> Lire intégralement avant d'écrire du code. Ne pas démarrer la Phase 1 avant que la Phase 0 ait validé son critère de sortie.

---

## 1. Thèse produit

**Ce que je ne comprends pas devient mon programme de révision.**

Quand j'écoute un podcast en espagnol et que je décroche sur 4 secondes, cette information est aujourd'hui perdue. Je continue, j'oublie, et je redécroche au même endroit le lendemain. L'app instrumente ce moment : un bouton, un timestamp, et le segment audio + son transcript entrent dans une file de révision.

L'unité de révision n'est **pas le mot**, c'est **le segment audio + sa phrase transcrite**. Un mot isolé ne transfère pas à la compréhension orale : on peut connaître `sciopero` sur une carte et ne pas l'entendre dans un flux. C'est la décision de design centrale du projet, tout le modèle de données en découle.

### Positionnement

| Outil | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|
| Anki | SRS excellent | Encodage 100% manuel, rien sur l'audio |
| LingQ | Mining de vocabulaire | Centré texte, audio secondaire |
| Duolingo | Gamification | Phrases artificielles, hors contexte |
| Pimsleur | Oral, mains libres | Programme fermé, non personnalisé |

Aucun ne ferme la boucle **écoute réelle → échec capturé → révision de ce segment précis → réécoute du même épisode plus tard**.

### Fondements pédagogiques (à respecter dans chaque décision d'UX)

- **Noticing hypothesis (Schmidt)** — on n'acquiert que ce qu'on remarque consciemment. Le bouton de capture est l'instrumentation directe du noticing. C'est le pilier.
- **Retrieval practice / effet de test** — se tester bat relire, résultat très robuste. Donc : rappel actif partout, jamais d'écoute passive non interrompue.
- **Répétition espacée** — appliquée à des segments, pas à des mots.
- **Output hypothesis (Swain)** — l'input seul ne suffit pas (l'hypothèse de Krashen est contestée sur ce point). La production forcée est structurelle, pas un bonus.

**Conséquence directe :** toute fonctionnalité qui permet une écoute passive prolongée sans action de l'utilisateur est un anti-pattern dans ce projet.

---

## 2. Profil utilisateur (utilisateur unique)

Trois langues, trois niveaux, trois traitements différents. **Ne pas construire un pipeline générique identique pour les trois.**

- **Anglais — C1 (TOEIC 950).** Comprend déjà. Cible : production et raffinement lexical. Contenu natif non simplifié.
- **Espagnol — réactivation.** Vocabulaire dormant, pas absent. Cible : rappel actif + volume d'écoute. Remonte vite.
- **Italien — A0.** Aucun input authentique possible à ce niveau. Cible : phrases courtes, répétition orale, contenu pour débutants uniquement.

Contextes d'usage : **mains occupées, yeux ailleurs** (salle de sport, transports, travail). Pas de créneau dédié. L'app est audio-first, l'écran est secondaire.

---

## 3. Contraintes dures

### 3.1 Distribution iOS sans licence développeur Apple (99 $/an)

C'est possible via le **free provisioning** (Personal Team dans Xcode, avec un simple Apple ID), mais les limites sont réelles et structurent le projet :

- **Le profil de provisioning expire au bout de 7 jours.** Passé ce délai, l'app ne se lance plus sur le téléphone tant qu'elle n'a pas été redéployée depuis Xcode.
- **3 apps sideloadées maximum** simultanément, **10 App IDs enregistrables par période de 7 jours**.
- **Entitlements indisponibles** : push notifications, iCloud, App Groups, Sign in with Apple, associated domains.

**Mitigations à appliquer :**

1. **Toujours réutiliser le même bundle identifier** : `com.<monid>.lacuna`, fixé une fois pour toutes. Changer de bundle ID consomme un App ID sur le quota de 10/7 jours, et c'est le piège classique.
2. **Notifications locales uniquement** (`LocalNotifications`), jamais de push. Les notifications locales ne demandent aucun entitlement payant et suffisent totalement pour des rappels quotidiens.
3. **Redéploiement hebdomadaire** depuis le Mac via Xcode (2 minutes). Alternative : AltStore / SideStore, qui re-signent automatiquement avec le même Apple ID gratuit et évitent le passage par le Mac — setup plus lourd, à envisager seulement si le rituel hebdomadaire devient pénible.
4. **Aucune donnée utilisateur ne doit vivre uniquement dans le conteneur de l'app.** Une réinstallation ne doit jamais faire perdre l'historique de captures et l'état FSRS. → Voir §6.4, la synchronisation n'est pas optionnelle.

**Android** : aucune de ces contraintes. APK signé en debug, installé directement.

### 3.2 Sources audio

- **Spotify est hors jeu** pour la lecture : l'API n'expose que les métadonnées et un extrait de 30 s, la lecture réelle impose leur SDK, un compte Premium et interdit l'offline. YouTube pose le même type de problème côté conditions d'utilisation.
- **La source est le flux RSS du podcast.** L'URL du MP3 est en clair dans la balise `<enclosure>`. Fetch, download, cache local. C'est tout.
- **Critère de sélection n°1 du catalogue : la présence d'un transcript aligné.** Sans alignement timestamp ↔ texte, une capture ne renvoie qu'un bout de son muet, inexploitable en révision. Le produit entier repose là-dessus.

### 3.3 Pas d'IA

Décision assumée. Aucun LLM, aucun service de transcription automatique, aucune API d'évaluation. Tout doit être **déterministe** : parsing, découpage, listes de fréquence, algorithme de répétition espacée, auto-évaluation par l'utilisateur.

L'auto-évaluation (« j'ai su / j'ai pas su ») est le modèle Anki. Ce n'est pas un pis-aller faute d'IA, c'est pédagogiquement valide.

---

## 4. Stack imposée

Uniquement des technos que je maîtrise déjà. Ne pas introduire de dépendance hors de cette liste sans la justifier explicitement.

| Couche | Techno | Raison |
|---|---|---|
| Backend | **Go** | Compétence différenciante. Ingestion concurrente des flux, parsing, scheduler. |
| Frontend | **Vue 3** (Composition API, TypeScript) | Déjà utilisé en production (projet SHAREO). |
| Shell mobile | **Capacitor** | Un seul codebase Vue → projets natifs iOS et Android. Le projet Xcode généré se signe en free provisioning. |
| DB serveur | **PostgreSQL** | Connu. |
| Cache serveur | **Redis** | Connu, déjà utilisé pour du cache de flux. |
| DB embarquée | **SQLite** (`@capacitor-community/sqlite`) | Offline-first obligatoire (métro). |
| Déploiement | **Docker** sur VPS Oracle | Setup existant. |

**Pourquoi Capacitor plutôt qu'une PWA :** la PWA Safari bloque sur trois points rédhibitoires ici — quota de cache imprévisible pour stocker des MP3, audio en arrière-plan fragile, et `getUserMedia` historiquement cassé en mode standalone. Capacitor donne le système de fichiers natif, un vrai lecteur audio en arrière-plan et le micro natif. Il supprime aussi le problème de CORS sur le fetch des flux RSS.

**Plugins Capacitor nécessaires :** `@capacitor/filesystem`, `@capacitor/local-notifications`, `@capacitor-community/sqlite`, `@capacitor/preferences`, un plugin de lecture audio en arrière-plan (à choisir et valider en Phase 2), et un plugin d'enregistrement micro (Phase 5 seulement).

---

## 5. Architecture

```
┌─────────────────────────── VPS Oracle (Docker) ───────────────────────────┐
│                                                                            │
│  ingester (Go, worker)          api (Go, HTTP/JSON)                        │
│  ─────────────────────          ───────────────────                        │
│  cron → fetch RSS               GET  /feeds                                │
│  parse <enclosure>              GET  /episodes?lang=&level=                │
│  parse <podcast:transcript>     GET  /episodes/:id/segments                │
│  download VTT/SRT               POST /sync/captures                        │
│  découpe en segments            GET  /sync/state                           │
│  calcule difficulté                                                        │
│         │                              │                                   │
│         └──────► PostgreSQL ◄──────────┘         Redis (cache feeds/ETag)  │
└────────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │  HTTPS — pull contenu / push captures
                                   ▼
┌────────────────────── App Capacitor (iOS + Android) ──────────────────────┐
│  Vue 3 + TS                                                                │
│  SQLite locale : episodes cachés, segments, captures, review_state         │
│  Filesystem    : fichiers MP3 téléchargés                                  │
│  3 modes : TRANSPORT (écoute+capture) · SALLE (cartes) · REVUE (écran)     │
└────────────────────────────────────────────────────────────────────────────┘
```

**Le MP3 n'est jamais proxifié par le backend.** L'app télécharge directement depuis l'URL d'origine. Le backend ne sert que des métadonnées et des segments texte : il reste léger et ne pose aucun problème de bande passante ni de droits.

---

## 6. Modèle de données

### 6.1 Serveur (PostgreSQL)

```sql
CREATE TABLE feed (
    id              BIGSERIAL PRIMARY KEY,
    rss_url         TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    lang            TEXT NOT NULL,           -- 'en' | 'es' | 'it'
    level           TEXT NOT NULL,           -- 'beginner' | 'intermediate' | 'native'
    has_transcripts BOOLEAN NOT NULL DEFAULT FALSE,
    etag            TEXT,                    -- cache conditionnel
    last_modified   TEXT,
    last_fetched_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE episode (
    id             BIGSERIAL PRIMARY KEY,
    feed_id        BIGINT NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
    guid           TEXT NOT NULL,
    title          TEXT NOT NULL,
    audio_url      TEXT NOT NULL,
    duration_s     INT,
    published_at   TIMESTAMPTZ,
    transcript_url TEXT,
    transcript_type TEXT,                    -- 'vtt' | 'srt' | 'json' | NULL
    segments_ready BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (feed_id, guid)
);

-- Unité centrale du produit.
CREATE TABLE segment (
    id          BIGSERIAL PRIMARY KEY,
    episode_id  BIGINT NOT NULL REFERENCES episode(id) ON DELETE CASCADE,
    idx         INT NOT NULL,                -- ordre dans l'épisode
    start_ms    INT NOT NULL,
    end_ms      INT NOT NULL,
    text        TEXT NOT NULL,
    speaker     TEXT,
    word_count  INT NOT NULL,
    -- difficulté déterministe : % de tokens hors des N mots les plus fréquents
    rare_ratio  REAL,
    UNIQUE (episode_id, idx)
);
CREATE INDEX ON segment (episode_id, start_ms);

-- Listes de fréquence (OpenSubtitles / Tatoeba), pour le calcul de difficulté et les cloze.
CREATE TABLE frequency_word (
    lang TEXT NOT NULL,
    word TEXT NOT NULL,
    rank INT  NOT NULL,
    PRIMARY KEY (lang, word)
);

-- Banque de questions du mode salle. Écrite à la main / dérivée de Tatoeba.
CREATE TABLE prompt (
    id          BIGSERIAL PRIMARY KEY,
    lang        TEXT NOT NULL,
    context     TEXT NOT NULL,               -- 'gym' pour la v1
    level       TEXT NOT NULL,
    question    TEXT NOT NULL,
    answer_mode TEXT NOT NULL,               -- 'choice' | 'speak' | 'text'
    choices     JSONB,                       -- si 'choice'
    model_answer TEXT                        -- si 'speak' : la réponse native à révéler
);
```

### 6.2 Client (SQLite)

Miroir en lecture seule de `episode`, `segment`, `prompt` pour les contenus téléchargés, plus les deux tables qui appartiennent à l'utilisateur :

```sql
CREATE TABLE capture (
    id          TEXT PRIMARY KEY,            -- UUID généré client
    segment_id  INTEGER NOT NULL,
    episode_id  INTEGER NOT NULL,
    captured_at INTEGER NOT NULL,            -- epoch ms
    kind        TEXT NOT NULL,               -- 'not_understood' | 'unknown_word' | 'liked'
    note        TEXT,
    synced      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE review_state (                  -- état FSRS, une ligne par segment en révision
    segment_id   INTEGER PRIMARY KEY,
    due_at       INTEGER NOT NULL,
    stability    REAL NOT NULL,
    difficulty   REAL NOT NULL,
    reps         INTEGER NOT NULL DEFAULT 0,
    lapses       INTEGER NOT NULL DEFAULT 0,
    last_grade   INTEGER,
    last_review  INTEGER,
    synced       INTEGER NOT NULL DEFAULT 0
);
```

### 6.3 Difficulté d'un segment — déterministe, sans IA

`rare_ratio` = proportion de tokens absents des N mots les plus fréquents de la langue (N = 1000 pour débutant, 3000 pour intermédiaire, 5000 pour avancé). Sert à trier les épisodes par niveau et à choisir les mots à masquer dans les cloze. Rien d'autre. Ne pas chercher à implémenter une métrique de lisibilité sophistiquée.

### 6.4 Synchronisation

Volontairement asymétrique et simple. **Ne pas construire un moteur de sync bidirectionnel avec résolution de conflits** — utilisateur unique, un seul appareil actif à la fois.

- **Contenu** : pull only, serveur → client.
- **Données utilisateur** (`capture`, `review_state`) : push périodique client → serveur, last-write-wins sur `updated_at`. Le serveur est une sauvegarde, il ne modifie jamais ces lignes.

C'est ce qui rend la réinstallation hebdomadaire (contrainte §3.1) indolore.

---

## 7. Les trois modes

### TRANSPORT — écoute + capture (le cœur du produit)

Écran quasi vide, une seule grande zone tapable occupant la majorité de l'écran : **« j'ai pas capté »**. Utilisable à l'aveugle, téléphone en poche, via les contrôles de l'écran de verrouillage.

- Un tap → on enregistre le timestamp courant, on résout le segment correspondant, on crée une `capture`. Aucune interruption de la lecture, aucun feedback bloquant.
- **Checkpoints** : toutes les 90 secondes, l'audio se coupe et exige une action pour reprendre (rejouer les 15 dernières secondes, ou continuer). C'est le garde-fou contre l'écoute passive. Intervalle configurable, jamais désactivable entièrement.
- Fonctionne intégralement hors ligne sur les épisodes téléchargés.

### SALLE — cartes entre les séries

Le créneau est **les 60–90 secondes entre deux séries** : temps mort récurrent, 15 à 20 fois par séance, déjà dans la routine. C'est le meilleur hook quotidien du projet.

- Questions issues de la table `prompt`, contexte `gym`.
- **Pas de saisie clavier par défaut** (mains moites, téléphone en poche). QCM et cartes en priorité.
- Mode `speak` : la question s'affiche/se dit, je réponds à voix haute, je tape pour révéler la réponse modèle, je m'auto-note. Principe Pimsleur. C'est le mode le plus formateur, il doit être au moins aussi accessible que le QCM.

### REVUE — le soir, écran

- File des captures de la journée : segment audio rejouable + transcript + contexte (segment précédent et suivant).
- Génération de **cloze déterministes** : tokenisation du segment, masquage des mots dont le `rank` est au-delà du seuil de la langue.
- Notation FSRS sur chaque segment.
- Vue « épisodes à réécouter » : un épisode dont plusieurs segments arrivent à échéance remonte pour une réécoute complète. C'est la boucle qui ferme le produit.

---

## 8. Phases

### Phase 0 — Spike transcripts ⚠️ BLOQUANT

**C'est le seul risque capable d'invalider le concept entier. Rien d'autre ne démarre avant.**

Écrire un binaire Go autonome (`cmd/spike/`) qui :

1. prend une liste d'URLs de flux RSS en entrée ;
2. parse chaque flux, y compris le namespace **Podcasting 2.0** (`xmlns:podcast="https://podcastindex.org/namespace/1.0"`), en cherchant la balise `<podcast:transcript url="..." type="..."/>` au niveau `<item>` ;
3. télécharge un transcript, le parse (VTT et SRT), et vérifie que les timestamps sont exploitables ;
4. sort un rapport : par flux, présence de transcripts, format, nombre de segments, couverture temporelle, durée moyenne d'un segment.

**Input** : 15 à 20 flux, répartis en anglais natif, espagnol pour apprenants, espagnol natif, italien pour débutants.

**Critère de sortie** : au moins 2 flux exploitables par langue, dont au moins un en italien débutant. L'italien est le maillon faible, c'est là que ça peut casser.

**Si le critère n'est pas atteint** : ne pas continuer tel quel, revenir vers moi. Les replis possibles sont (a) restreindre l'italien à des sources avec transcript fourni hors RSS, (b) accepter un alignement manuel pour l'italien uniquement, (c) revoir le périmètre italien. Ne pas décider seul, et surtout ne pas introduire de transcription automatique — ça viole la contrainte §3.3.

### Phase 1 — Backend d'ingestion

- Structure du repo, `docker-compose` (Postgres + Redis + api + ingester), migrations SQL.
- Ingester : fetch concurrent des flux (worker pool, `errgroup`), respect d'ETag / If-Modified-Since, backoff.
- Parsing VTT/SRT → table `segment`. Fusionner les cues trop courts pour obtenir des segments d'une phrase environ (viser 3–15 s, ne jamais garder un cue de moins de 1,5 s isolé).
- Import des listes de fréquence, calcul de `rare_ratio`.
- API JSON en lecture.
- **Sortie attendue** : un `curl` sur `/episodes?lang=es` renvoie des épisodes avec segments alignés en base.

### Phase 2 — Shell mobile + mode TRANSPORT

- Scaffold Vue 3 + Capacitor, ajout des plateformes iOS et Android.
- **Valider le build et l'installation sur iPhone en free provisioning dès le premier jour de cette phase**, avec un écran vide. Ne pas découvrir un problème de signature après trois semaines de dev.
- Téléchargement d'épisode (audio → Filesystem, segments → SQLite).
- Lecteur audio avec arrière-plan et contrôles d'écran de verrouillage.
- Bouton de capture + résolution timestamp → segment.
- Checkpoints à 90 s.
- **Sortie attendue** : je télécharge un épisode chez moi, j'écoute dans le métro en mode avion, je capture 5 passages, ils sont en base locale.

### Phase 3 — Mode REVUE + FSRS

- Intégration FSRS (côté client ; vérifier l'état de `open-spaced-repetition/ts-fsrs`, sinon implémentation directe de l'algorithme, il est documenté publiquement).
- File de révision, replay de segment, cloze déterministes, notation.
- Sync vers le backend.
- **Sortie attendue** : une capture du lundi me revient au bon moment, avec son audio et son texte.

### Phase 4 — Mode SALLE

- Écriture de la banque `prompt` : viser 150–200 questions par langue sur le domaine `gym`. **C'est le vrai coût de cette phase, pas le code.** Le domaine est fini (exercices, séries, répétitions, charges, sensations, matériel, fatigue). S'appuyer sur **Tatoeba** (corpus libre de phrases traduites, dumps téléchargeables, audio natif sur une partie) plutôt que de tout écrire à la main.
- UI grosse cible tactile, QCM + mode `speak`.
- Notifications locales de rappel.

### Phase 5 — Production orale (optionnelle, à rediscuter)

Enregistrement micro + shadowing segmenté avec auto-évaluation. Sans IA, pas de correction automatique : la valeur vient de la comparaison avec le modèle natif et de l'auto-notation. À n'ouvrir que si les phases 1 à 4 sont réellement utilisées au quotidien.

---

## 9. Conventions et règles de travail

- **Go** : `cmd/` + `internal/`, `sqlc` ou `pgx` direct (pas d'ORM), migrations avec `golang-migrate`, erreurs enveloppées avec contexte, tests sur les parsers (VTT/SRT/RSS) qui sont la partie la plus fragile.
- **Vue** : Composition API, TypeScript strict, Pinia pour l'état, pas de framework UI lourd.
- **Une phase = une session de travail.** Ne pas anticiper sur les phases suivantes, ne pas créer de couche d'abstraction « au cas où ».
- **Toujours le même bundle identifier** (cf. §3.1, quota d'App IDs).
- Aucun secret en dur. Aucune clé d'API tierce n'est nécessaire dans ce projet, et c'est voulu.
- Si une décision d'architecture contredit ce document, s'arrêter et demander plutôt que d'improviser.
