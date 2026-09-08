import type { Verb } from '../../services/conjugator'

// Verbes espagnols les plus fréquents. Même principe qu'en italien : seules
// les formes irrégulières sont écrites, le reste est dérivé.
// À noter : en espagnol l'imparfait n'a que trois irréguliers (ser, ir, ver),
// tout le reste suit la règle — d'où si peu d'entrées `imperfect` ici.
export const ES_VERBS: Verb[] = [
  {
    lemma: 'ser',
    fr: 'être (identité)',
    irregular: {
      present: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
      imperfect: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
      future: ['seré', 'serás', 'será', 'seremos', 'seréis', 'serán'],
    },
  },
  {
    lemma: 'estar',
    fr: 'être (état, lieu)',
    irregular: { present: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'] },
  },
  {
    lemma: 'tener',
    fr: 'avoir',
    irregular: { present: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'] },
    futureStem: 'tendr',
  },
  {
    lemma: 'haber',
    fr: 'avoir (auxiliaire)',
    irregular: { present: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'] },
    futureStem: 'habr',
  },
  {
    lemma: 'ir',
    fr: 'aller',
    irregular: {
      present: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
      imperfect: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
      future: ['iré', 'irás', 'irá', 'iremos', 'iréis', 'irán'],
    },
  },
  {
    lemma: 'hacer',
    fr: 'faire',
    irregular: { present: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'] },
    futureStem: 'har',
  },
  {
    lemma: 'poder',
    fr: 'pouvoir',
    irregular: { present: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'] },
    futureStem: 'podr',
  },
  {
    lemma: 'querer',
    fr: 'vouloir, aimer',
    irregular: { present: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'] },
    futureStem: 'querr',
  },
  {
    lemma: 'decir',
    fr: 'dire',
    irregular: { present: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'] },
    futureStem: 'dir',
  },
  {
    lemma: 'venir',
    fr: 'venir',
    irregular: { present: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'] },
    futureStem: 'vendr',
  },
  {
    lemma: 'saber',
    fr: 'savoir',
    irregular: { present: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'] },
    futureStem: 'sabr',
  },
  {
    lemma: 'ver',
    fr: 'voir',
    irregular: {
      present: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
      imperfect: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
    },
  },
  {
    lemma: 'dar',
    fr: 'donner',
    irregular: { present: ['doy', 'das', 'da', 'damos', 'dais', 'dan'] },
  },
  {
    lemma: 'poner',
    fr: 'mettre, poser',
    irregular: { present: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'] },
    futureStem: 'pondr',
  },
  {
    lemma: 'salir',
    fr: 'sortir',
    irregular: { present: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'] },
    futureStem: 'saldr',
  },
  {
    lemma: 'pedir',
    fr: 'demander, commander',
    irregular: { present: ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden'] },
  },
  {
    lemma: 'dormir',
    fr: 'dormir',
    irregular: { present: ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen'] },
  },
  {
    lemma: 'empezar',
    fr: 'commencer',
    irregular: { present: ['empiezo', 'empiezas', 'empieza', 'empezamos', 'empezáis', 'empiezan'] },
  },
  {
    lemma: 'conocer',
    fr: 'connaître',
    irregular: { present: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocéis', 'conocen'] },
  },
  {
    lemma: 'deber',
    fr: 'devoir',
  },

  // Réguliers.
  { lemma: 'hablar', fr: 'parler' },
  { lemma: 'trabajar', fr: 'travailler' },
  { lemma: 'estudiar', fr: 'étudier' },
  { lemma: 'comprar', fr: 'acheter' },
  { lemma: 'mirar', fr: 'regarder' },
  { lemma: 'escuchar', fr: 'écouter' },
  { lemma: 'esperar', fr: 'attendre, espérer' },
  { lemma: 'llamar', fr: 'appeler' },
  { lemma: 'llevar', fr: 'porter, emmener' },
  { lemma: 'tomar', fr: 'prendre' },
  { lemma: 'buscar', fr: 'chercher' },
  { lemma: 'necesitar', fr: 'avoir besoin de' },
  { lemma: 'comer', fr: 'manger' },
  { lemma: 'beber', fr: 'boire' },
  { lemma: 'aprender', fr: 'apprendre' },
  { lemma: 'leer', fr: 'lire' },
  { lemma: 'comprender', fr: 'comprendre' },
  { lemma: 'vender', fr: 'vendre' },
  { lemma: 'vivir', fr: 'vivre, habiter' },
  { lemma: 'escribir', fr: 'écrire' },
  { lemma: 'abrir', fr: 'ouvrir' },
  { lemma: 'recibir', fr: 'recevoir' },
  { lemma: 'subir', fr: 'monter' },
]
