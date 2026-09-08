# Lacuna

> *lacuna* — le trou dans la compréhension. Cognat dans les deux langues
> cibles : *lacuna* en italien, *laguna* en espagnol.

Une app mobile pour apprendre l'italien et l'espagnol à partir de ce qu'on
avait déjà envie de regarder.

---

## Pourquoi cette app existe

On abandonne une langue parce que le contenu est ennuyeux. Les phrases
d'application ne parlent de rien, et le contenu « authentique » proposé est
rarement celui qu'on aurait regardé de toute façon.

Lacuna part de l'inverse : tu dis ce qui t'intéresse — sport, musique,
informatique, sport automobile, ou simplement apprendre la langue — et l'app
va chercher des vidéos récentes sur ces sujets, en italien, en espagnol, ou
dans les deux à la fois.
À côté, des exercices écrits à la main et une révision espacée qui te ramène
ce que tu es sur le point d'oublier.

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

**Le rappel actif dans les exercices, pas dans le fil.** Le cadrage d'origine
bannissait toute consommation passive. Ce n'est plus tenable depuis que le
contenu est de la vidéo : regarder YouTube est passif, et le prétendre
autrement serait mentir sur ce que fait l'app. La ligne a donc été déplacée
plutôt qu'abandonnée — le fil vidéo est de l'input, assumé comme tel ;
Fondations, Culture G et la révision espacée sont du rappel actif, sans
exception.

**On ne coche rien à ta place.** L'onboarding arrive vide : ni langue, ni
centre d'intérêt pré-sélectionné. Pré-cocher reviendrait à répondre pour
l'utilisateur, et à ce compte-là autant ne pas poser la question. La
contrepartie est qu'on refuse d'avancer tant qu'au moins une langue et un
sujet ne sont pas choisis — sinon l'accueil serait vide au tout premier
lancement.

**Aucune source ne monopolise le fil.** Trier par date seule laissait la
chaîne la plus prolifique remplir l'écran : sur 24 vidéos espagnoles, une
seule chaîne en occupait 15, et cocher un centre d'intérêt de plus ne
changeait qu'une ligne enfouie. Les sources alternent donc — la plus récente
de chacune d'abord, puis la deuxième de chacune. Un réglage qu'on change doit
se voir.

## Ce qu'il y a dedans

| Mode | Ce que ça fait |
|---|---|
| **À regarder** | Des vidéos YouTube récentes en IT/ES, filtrées sur tes centres d'intérêt |
| **Fondations** | Scénarios écrits à la main + exercices de conjugaison générés |
| **Culture G** | Questions de culture générale dans la langue cible, expliquées en français |
| **Articles** | Presse quotidienne (ANSA, la Repubblica, BBC Mundo, Infobae) avec les mots rares mis en évidence |
| **Sport** | Les titres de L'Équipe, filtrés sur tes sports, à redire en langue cible |
| **Onboarding** | Au premier lancement : langues et centres d'intérêt, rien de pré-coché |
| **Réglages** | Langues, centres d'intérêt, sports, thème clair/sombre, notifications |

Les vidéos viennent de 15 chaînes suivies par leur flux public, réparties en
cinq centres d'intérêt (langue, sport, musique, informatique, sport
automobile) et deux langues.

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
internal/         Parsing RSS et Atom, ingestion, API JSON, sync
migrations/       Schéma Postgres (golang-migrate, embarqué dans le binaire)
app/              Client Vue 3 + Capacitor (iOS)
  src/data/       Contenu écrit à la main : scénarios, verbes, culture G
  src/services/   Conjugaison, FSRS, fréquence lexicale, traduction native
  src/db/         SQLite local
  ios/App/        Plugin Swift de traduction sur appareil
```

Le personnage est une bulle de parole à qui il manque un morceau : la lacune
du nom, celle que l'app comble. Il est dessiné en SVG dans le client et
regénéré en PNG pour l'icône iOS, à partir de la même géométrie.

Le backend est en Go (Postgres + Redis, `docker compose up`). Le client est en
Vue 3 / TypeScript, empaqueté par Capacitor. La répétition espacée utilise
FSRS via `ts-fsrs`, sur deux files indépendantes : conjugaison (Fondations)
et culture générale.

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
- **Une chaîne peut exister et servir un flux vide.** @FormulaPassion répond
  HTTP 200 sans aucune entrée, comme les chemins `/Volley/` et `/Volleyball/`
  chez L'Équipe. Un code 200 ne prouve rien : toute source ajoutée est
  vérifiée sur son contenu réel, et sa langue contrôlée sur les titres plutôt
  que déduite du nom.
- **UniMorph ne peut pas servir de source de conjugaison** : le dataset
  italien n'a ni `essere`, ni `avere`, ni `potere`, et omet le présent
  irrégulier des verbes courants. Il ne sert que de vérificateur.

## Contexte

Projet personnel, utilisateur unique. Le cadrage complet — thèse produit,
fondements pédagogiques, contraintes de distribution iOS — est dans
[PLAN-PROJET.md](PLAN-PROJET.md).
