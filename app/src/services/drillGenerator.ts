// Génération d'exercices de conjugaison à la volée : la réserve d'items
// n'est plus une liste écrite à la main mais tout le produit
// verbes × temps × personnes (≈ 800 items par langue aujourd'hui, et une
// ligne suffit pour ajouter un verbe).
//
// Deux propriétés importantes :
//  - l'id est déterministe (`gen:it:parlare:present:2sg`), donc FSRS suit un
//    item généré exactement comme un item écrit à la main : la répétition
//    espacée continue de fonctionner d'une session à l'autre ;
//  - les distracteurs sont les AUTRES personnes du même verbe, c'est-à-dire
//    précisément les formes qu'on confond — un distracteur tiré d'un autre
//    verbe serait éliminable sans rien savoir de la conjugaison.
import { findConjugItem } from '../data/fondations'
import { ES_VERBS } from '../data/verbs/es'
import { IT_VERBS } from '../data/verbs/it'
import { conjugate, PERSONS, PRONOUNS, TENSE_LABELS, type Person, type Tense, type Verb } from './conjugator'
import { shuffle } from './shuffle'
import type { ConjugItem } from '../types/models'

const VERBS_BY_LANG: Record<string, Verb[]> = { it: IT_VERBS, es: ES_VERBS }

export function verbsForLang(lang: string): Verb[] {
  return VERBS_BY_LANG[lang] ?? []
}

export function generatedItemId(lang: string, lemma: string, tense: Tense, person: Person): string {
  return `gen:${lang}:${lemma}:${tense}:${person}`
}

// buildDrill produit l'item pour une combinaison précise. Renvoie null si le
// verbe n'est pas conjugable à ce temps (garde-fou : mieux vaut sauter un
// item que d'en poser un dont la réponse serait fausse).
// Les scénarios écrits à la main contiennent des phrases contextualisées et
// traduites — « io ___ italiano / je suis italien » — bien plus utiles qu'un
// « io ___ » nu. Elles ne couvrent que io et tu, sous un autre schéma d'id.
//
// On récupère leur ÉNONCÉ mais on garde l'id généré : deux ids pour la même
// connaissance scinderaient la révision espacée en deux états divergents.
function handwrittenPrompt(
  lang: string,
  lemma: string,
  tense: Tense,
  person: Person,
  answer: string,
): { prompt: string; promptFr?: string } | null {
  const pronoun = person === '1sg' ? 'io' : person === '2sg' ? 'tu' : null
  if (!pronoun) return null

  const written = findConjugItem(lang, `${lang}-${lemma}-${pronoun}-${TENSE_LABELS[lang][tense]}`)
  // La réponse doit coïncider : un énoncé écrit pour une autre forme
  // rendrait la question fausse.
  if (!written || written.answer !== answer) return null
  return { prompt: written.prompt, promptFr: written.promptFr }
}

export function buildDrill(lang: string, verb: Verb, tense: Tense, person: Person): ConjugItem | null {
  const forms = conjugate(lang, verb, tense)
  if (!forms) return null

  const index = PERSONS.indexOf(person)
  const answer = forms[index]

  // Distracteurs : formes voisines distinctes de la réponse. Certains verbes
  // ont des formes identiques à deux personnes (italien "sono" = 1sg et 3pl),
  // d'où le dédoublonnage avant tirage.
  const distractors = shuffle([...new Set(forms.filter((f) => f !== answer))]).slice(0, 2)
  if (distractors.length < 2) return null

  const written = handwrittenPrompt(lang, verb.lemma, tense, person, answer)

  return {
    id: generatedItemId(lang, verb.lemma, tense, person),
    verb: verb.lemma,
    tense: TENSE_LABELS[lang][tense],
    prompt: written?.prompt ?? `${PRONOUNS[lang][person]} ___`,
    promptFr: written?.promptFr,
    options: shuffle([answer, ...distractors]),
    answer,
    hint: verb.fr,
  }
}

// resolveGeneratedItem reconstruit un item à partir de son id. Indispensable
// pour la révision espacée : quand un item généré redevient dû, on n'a que
// son id en base — il faut pouvoir le régénérer à l'identique.
export function resolveGeneratedItem(id: string): ConjugItem | null {
  const [prefix, lang, lemma, tense, person] = id.split(':')
  if (prefix !== 'gen') return null

  const verb = verbsForLang(lang).find((v) => v.lemma === lemma)
  if (!verb) return null
  if (!PERSONS.includes(person as Person)) return null

  return buildDrill(lang, verb, tense as Tense, person as Person)
}

// verbOfItemId retrouve le verbe d'un item généré, pour regrouper les
// statistiques de maîtrise par verbe.
export function verbOfItemId(id: string): string | null {
  const [prefix, , lemma] = id.split(':')
  return prefix === 'gen' ? (lemma ?? null) : null
}

// Les temps s'ouvrent progressivement : tant qu'un verbe n'est pas solide au
// présent, l'entraîner à l'imparfait ou au futur n'a pas de sens.
export function tensesForMastery(tier: string | undefined): Tense[] {
  if (tier === 'gold') return ['present', 'imperfect', 'future']
  if (tier === 'silver') return ['present', 'imperfect']
  return ['present']
}

// generateDrills tire `count` items en priorisant les verbes les moins
// maîtrisés (c'est ce qui rend l'entraînement personnel : deux personnes avec
// des historiques différents ne reçoivent pas les mêmes exercices).
export function generateDrills(
  lang: string,
  count: number,
  mastery: Record<string, string>,
): ConjugItem[] {
  const verbs = verbsForLang(lang)
  if (verbs.length === 0) return []

  const tierWeight: Record<string, number> = { new: 4, bronze: 3, silver: 2, gold: 1 }
  const pool: Verb[] = []
  for (const verb of verbs) {
    const weight = tierWeight[mastery[verb.lemma] ?? 'new'] ?? 4
    for (let i = 0; i < weight; i++) pool.push(verb)
  }

  const items: ConjugItem[] = []
  const seen = new Set<string>()
  // Borne d'essais : le tirage peut retomber sur une combinaison déjà prise
  // ou non conjugable, on ne veut pas boucler indéfiniment.
  for (let attempts = 0; attempts < count * 20 && items.length < count; attempts++) {
    const verb = pool[Math.floor(Math.random() * pool.length)]
    const tenses = tensesForMastery(mastery[verb.lemma])
    const tense = tenses[Math.floor(Math.random() * tenses.length)]
    const person = PERSONS[Math.floor(Math.random() * PERSONS.length)]

    const id = generatedItemId(lang, verb.lemma, tense, person)
    if (seen.has(id)) continue

    const item = buildDrill(lang, verb, tense, person)
    if (!item) continue

    seen.add(id)
    items.push(item)
  }
  return items
}
