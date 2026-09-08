import { conjugate, PERSONS, PRONOUNS, TENSE_LABELS, type Tense, type Verb } from './conjugator'
import { generatedItemId, verbsForLang } from './drillGenerator'

// Un parcours ordonné, pour répondre à « on ne sait pas où ça mène ».
//
// Une leçon = un verbe à un temps, soit six formes. C'est assez court pour
// être présenté d'un coup avant d'être pratiqué, et assez grand pour valoir
// une session. L'ordre vient du fichier de verbes, déjà classé par
// fréquence : essere et avere avant vivere et pulire.
//
// Les temps se suivent plutôt que de s'entremêler : tous les présents des
// verbes retenus, ensuite les imparfaits, ensuite les futurs. Un débutant
// qui ne sait pas encore dire « je suis » n'a rien à faire au futur.
const TENSE_ORDER: Tense[] = ['present', 'imperfect', 'future']

// Nombre de verbes ouverts par temps. Les 46 verbes de l'inventaire au
// présent feraient 46 leçons avant le premier imparfait : trop long avant de
// voir un autre temps, et décourageant à l'affichage.
const VERBS_PER_TENSE = 12

export interface LessonForm {
  person: string
  pronoun: string
  form: string
  itemId: string
}

export interface Lesson {
  id: string
  lang: string
  index: number
  verb: Verb
  tense: Tense
  tenseLabel: string
  forms: LessonForm[]
}

export function lessonsForLang(lang: string): Lesson[] {
  const verbs = verbsForLang(lang).slice(0, VERBS_PER_TENSE)
  const lessons: Lesson[] = []

  for (const tense of TENSE_ORDER) {
    for (const verb of verbs) {
      const forms = conjugate(lang, verb, tense)
      // Un verbe sans forme dérivable à ce temps est sauté plutôt que servi
      // à moitié : mieux vaut une leçon de moins qu'une leçon fausse.
      if (!forms) continue

      lessons.push({
        id: `${lang}:${verb.lemma}:${tense}`,
        lang,
        index: lessons.length,
        verb,
        tense,
        tenseLabel: TENSE_LABELS[lang]?.[tense] ?? tense,
        forms: PERSONS.map((person, i) => ({
          person,
          pronoun: PRONOUNS[lang][person],
          form: forms[i],
          itemId: generatedItemId(lang, verb.lemma, tense, person),
        })),
      })
    }
  }
  return lessons
}

export type LessonState = 'done' | 'current' | 'locked'

// L'état se déduit de la révision espacée elle-même, pas d'un compteur
// séparé : deux sources de vérité divergeraient tôt ou tard. `acquired`
// contient les formes dont la dernière réponse était juste — pas celles
// simplement rencontrées, sous peine de valider une leçon entièrement ratée.
export function lessonStates(
  lessons: Lesson[],
  acquired: Set<string>,
): Map<string, LessonState> {
  const states = new Map<string, LessonState>()
  let currentFound = false

  for (const lesson of lessons) {
    const done = lesson.forms.every((f) => acquired.has(f.itemId))
    if (done) {
      states.set(lesson.id, 'done')
      continue
    }
    // La première leçon non acquise est celle à faire ; les suivantes
    // attendent. Sans ce verrou, l'écran redevient une liste sans direction.
    states.set(lesson.id, currentFound ? 'locked' : 'current')
    currentFound = true
  }
  return states
}
