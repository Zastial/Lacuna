// Moteur de conjugaison déterministe (§3.3 : pas d'IA). Les formes
// régulières sont dérivées par règle — ce qui couvre un nombre illimité de
// verbes — et seules les formes réellement irrégulières sont stockées.
//
// Pourquoi pas UniMorph : le dataset couvre ~10 000 verbes italiens, mais il
// omet précisément le présent irrégulier des verbes courants (andare y a
// "andai" et "andando", pas "vado"). Ses paradigmes complets sont ceux de
// verbes rares et réguliers, donc inutilisables pour un débutant. Il sert
// ici seulement de vérificateur (tools/verify-conjugations.mjs).

export type Tense = 'present' | 'imperfect' | 'future'

export const PERSONS = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'] as const
export type Person = (typeof PERSONS)[number]

export const PRONOUNS: Record<string, Record<Person, string>> = {
  it: { '1sg': 'io', '2sg': 'tu', '3sg': 'lui/lei', '1pl': 'noi', '2pl': 'voi', '3pl': 'loro' },
  es: { '1sg': 'yo', '2sg': 'tú', '3sg': 'él/ella', '1pl': 'nosotros', '2pl': 'vosotros', '3pl': 'ellos' },
}

export const TENSE_LABELS: Record<string, Record<Tense, string>> = {
  it: { present: 'presente', imperfect: 'imperfetto', future: 'futuro semplice' },
  es: { present: 'presente', imperfect: 'imperfecto', future: 'futuro simple' },
}

// Un verbe : les formes irrégulières sont données explicitement, tout le
// reste est dérivé. `futureStem` couvre le cas fréquent d'un verbe régulier
// au présent mais à radical irrégulier au futur (et inversement).
export interface Verb {
  lemma: string
  fr: string
  // Conjugaison isc- (finire -> finisco), spécifique à l'italien.
  isc?: boolean
  irregular?: Partial<Record<Tense, string[]>>
  futureStem?: string
}

type Endings = Record<Tense, string[]>

const IT_ENDINGS: Record<string, Endings> = {
  are: {
    present: ['o', 'i', 'a', 'iamo', 'ate', 'ano'],
    imperfect: ['avo', 'avi', 'ava', 'avamo', 'avate', 'avano'],
    future: ['erò', 'erai', 'erà', 'eremo', 'erete', 'eranno'],
  },
  ere: {
    present: ['o', 'i', 'e', 'iamo', 'ete', 'ono'],
    imperfect: ['evo', 'evi', 'eva', 'evamo', 'evate', 'evano'],
    future: ['erò', 'erai', 'erà', 'eremo', 'erete', 'eranno'],
  },
  ire: {
    present: ['o', 'i', 'e', 'iamo', 'ite', 'ono'],
    imperfect: ['ivo', 'ivi', 'iva', 'ivamo', 'ivate', 'ivano'],
    future: ['irò', 'irai', 'irà', 'iremo', 'irete', 'iranno'],
  },
}

// Verbes en -isc- : le radical s'allonge sauf aux deux personnes du pluriel.
const IT_ISC_PRESENT = ['isco', 'isci', 'isce', 'iamo', 'ite', 'iscono']

const ES_ENDINGS: Record<string, Endings> = {
  ar: {
    present: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    imperfect: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    future: ['aré', 'arás', 'ará', 'aremos', 'aréis', 'arán'],
  },
  er: {
    present: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    imperfect: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    future: ['eré', 'erás', 'erá', 'eremos', 'eréis', 'erán'],
  },
  ir: {
    present: ['o', 'es', 'e', 'imos', 'ís', 'en'],
    imperfect: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    future: ['iré', 'irás', 'irá', 'iremos', 'iréis', 'irán'],
  },
}

// Terminaisons du futur quand le radical est irrégulier : elles sont
// identiques pour tous les verbes des deux langues, seul le radical change.
const IT_FUTURE_ENDINGS = ['ò', 'ai', 'à', 'emo', 'ete', 'anno']
const ES_FUTURE_ENDINGS = ['é', 'ás', 'á', 'emos', 'éis', 'án']

function endingsFor(lang: string, lemma: string): Endings | null {
  const table = lang === 'it' ? IT_ENDINGS : ES_ENDINGS
  const group = lang === 'it' ? lemma.slice(-3) : lemma.slice(-2)
  return table[group] ?? null
}

// conjugate renvoie les 6 formes d'un verbe à un temps, dans l'ordre de
// PERSONS. Renvoie null si le verbe n'est pas conjugable par ces règles
// (infinitif hors des groupes connus et sans formes irrégulières fournies).
export function conjugate(lang: string, verb: Verb, tense: Tense): string[] | null {
  const explicit = verb.irregular?.[tense]
  if (explicit) return explicit

  if (tense === 'future' && verb.futureStem) {
    const endings = lang === 'it' ? IT_FUTURE_ENDINGS : ES_FUTURE_ENDINGS
    return endings.map((e) => verb.futureStem + e)
  }

  const endings = endingsFor(lang, verb.lemma)
  if (!endings) return null

  const groupLength = lang === 'it' ? 3 : 2
  const stem = verb.lemma.slice(0, -groupLength)

  if (lang === 'it' && verb.isc && tense === 'present') {
    return IT_ISC_PRESENT.map((e) => stem + e)
  }

  return endings[tense].map((e) => stem + e)
}
