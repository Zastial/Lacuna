import type { Verb } from '../../services/conjugator'

// Verbes italiens les plus fréquents. Ordre = priorité pédagogique : les
// irréguliers du haut sont ceux qu'on rencontre dans presque chaque phrase.
// Seules les formes réellement irrégulières sont listées ; l'imparfait et le
// futur réguliers sont dérivés par le moteur (cf. services/conjugator.ts).
export const IT_VERBS: Verb[] = [
  {
    lemma: 'essere',
    fr: 'être',
    irregular: {
      present: ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'],
      imperfect: ['ero', 'eri', 'era', 'eravamo', 'eravate', 'erano'],
    },
    futureStem: 'sar',
  },
  {
    lemma: 'avere',
    fr: 'avoir',
    irregular: { present: ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'] },
    futureStem: 'avr',
  },
  {
    lemma: 'fare',
    fr: 'faire',
    irregular: {
      present: ['faccio', 'fai', 'fa', 'facciamo', 'fate', 'fanno'],
      imperfect: ['facevo', 'facevi', 'faceva', 'facevamo', 'facevate', 'facevano'],
    },
    futureStem: 'far',
  },
  {
    lemma: 'andare',
    fr: 'aller',
    irregular: { present: ['vado', 'vai', 'va', 'andiamo', 'andate', 'vanno'] },
    futureStem: 'andr',
  },
  {
    lemma: 'potere',
    fr: 'pouvoir',
    irregular: { present: ['posso', 'puoi', 'può', 'possiamo', 'potete', 'possono'] },
    futureStem: 'potr',
  },
  {
    lemma: 'volere',
    fr: 'vouloir',
    irregular: { present: ['voglio', 'vuoi', 'vuole', 'vogliamo', 'volete', 'vogliono'] },
    futureStem: 'vorr',
  },
  {
    lemma: 'dovere',
    fr: 'devoir',
    irregular: { present: ['devo', 'devi', 'deve', 'dobbiamo', 'dovete', 'devono'] },
    futureStem: 'dovr',
  },
  {
    lemma: 'stare',
    fr: 'aller (santé), rester',
    irregular: { present: ['sto', 'stai', 'sta', 'stiamo', 'state', 'stanno'] },
    futureStem: 'star',
  },
  {
    lemma: 'dire',
    fr: 'dire',
    irregular: {
      present: ['dico', 'dici', 'dice', 'diciamo', 'dite', 'dicono'],
      imperfect: ['dicevo', 'dicevi', 'diceva', 'dicevamo', 'dicevate', 'dicevano'],
    },
    futureStem: 'dir',
  },
  {
    lemma: 'sapere',
    fr: 'savoir',
    irregular: { present: ['so', 'sai', 'sa', 'sappiamo', 'sapete', 'sanno'] },
    futureStem: 'sapr',
  },
  {
    lemma: 'dare',
    fr: 'donner',
    irregular: { present: ['do', 'dai', 'dà', 'diamo', 'date', 'danno'] },
    futureStem: 'dar',
  },
  {
    lemma: 'venire',
    fr: 'venir',
    irregular: { present: ['vengo', 'vieni', 'viene', 'veniamo', 'venite', 'vengono'] },
    futureStem: 'verr',
  },
  {
    lemma: 'uscire',
    fr: 'sortir',
    irregular: { present: ['esco', 'esci', 'esce', 'usciamo', 'uscite', 'escono'] },
  },
  {
    lemma: 'bere',
    fr: 'boire',
    irregular: {
      present: ['bevo', 'bevi', 'beve', 'beviamo', 'bevete', 'bevono'],
      imperfect: ['bevevo', 'bevevi', 'beveva', 'bevevamo', 'bevevate', 'bevevano'],
    },
    futureStem: 'berr',
  },
  {
    lemma: 'rimanere',
    fr: 'rester',
    irregular: { present: ['rimango', 'rimani', 'rimane', 'rimaniamo', 'rimanete', 'rimangono'] },
    futureStem: 'rimarr',
  },
  {
    lemma: 'tenere',
    fr: 'tenir',
    irregular: { present: ['tengo', 'tieni', 'tiene', 'teniamo', 'tenete', 'tengono'] },
    futureStem: 'terr',
  },
  {
    lemma: 'vedere',
    fr: 'voir',
    futureStem: 'vedr',
  },
  {
    lemma: 'vivere',
    fr: 'vivre',
    futureStem: 'vivr',
  },

  // Réguliers : entièrement dérivés par le moteur, une ligne suffit.
  { lemma: 'parlare', fr: 'parler' },
  { lemma: 'mangiare', fr: 'manger' },
  { lemma: 'lavorare', fr: 'travailler' },
  { lemma: 'studiare', fr: 'étudier' },
  { lemma: 'guardare', fr: 'regarder' },
  { lemma: 'ascoltare', fr: 'écouter' },
  { lemma: 'comprare', fr: 'acheter' },
  { lemma: 'trovare', fr: 'trouver' },
  { lemma: 'aspettare', fr: 'attendre' },
  { lemma: 'chiamare', fr: 'appeler' },
  { lemma: 'pensare', fr: 'penser' },
  { lemma: 'portare', fr: 'porter, apporter' },
  { lemma: 'credere', fr: 'croire' },
  { lemma: 'prendere', fr: 'prendre' },
  { lemma: 'scrivere', fr: 'écrire' },
  { lemma: 'leggere', fr: 'lire' },
  { lemma: 'chiedere', fr: 'demander' },
  { lemma: 'mettere', fr: 'mettre' },
  { lemma: 'perdere', fr: 'perdre' },
  { lemma: 'dormire', fr: 'dormir' },
  { lemma: 'aprire', fr: 'ouvrir' },
  { lemma: 'partire', fr: 'partir' },
  { lemma: 'sentire', fr: 'entendre, sentir' },
  { lemma: 'offrire', fr: 'offrir' },
  { lemma: 'finire', fr: 'finir', isc: true },
  { lemma: 'capire', fr: 'comprendre', isc: true },
  { lemma: 'preferire', fr: 'préférer', isc: true },
  { lemma: 'pulire', fr: 'nettoyer', isc: true },
]
