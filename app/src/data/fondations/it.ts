import type { Scenario } from '../../types/models'

export const IT_SCENARIOS: Scenario[] = [
  {
    id: 'it-bar',
    lang: 'it',
    title: 'Al bar',
    icon: 'ti-coffee',
    dialogue: [
      { speaker: 'Barista', target: 'Buongiorno! Cosa desidera?', fr: 'Bonjour ! Que désirez-vous ?' },
      { speaker: 'Tu', target: 'Vorrei un caffè, per favore.', fr: 'Je voudrais un café, s’il vous plaît.' },
      { speaker: 'Barista', target: 'Certo. Altro?', fr: 'Bien sûr. Autre chose ?' },
      { speaker: 'Tu', target: 'No grazie, è tutto.', fr: 'Non merci, c’est tout.' },
    ],
    vocab: [
      { target: 'vorrei', fr: 'je voudrais' },
      { target: 'per favore', fr: 's’il vous plaît' },
    ],
    mcqs: [
      {
        prompt: 'Il barista chiede: «Cosa desidera?» Tu rispondi:',
        fr: 'Le barman demande : « Que désirez-vous ? » Tu réponds :',
        options: [
          { target: 'Vorrei un caffè, per favore.', fr: 'Je voudrais un café, s’il vous plaît.', correct: true },
          { target: 'Mi chiamo Marco.', fr: 'Je m’appelle Marco.', correct: false },
          { target: 'Sono le tre.', fr: 'Il est trois heures.', correct: false },
        ],
        hint: 'vorrei + [chose] = façon polie de commander',
      },
    ],
    conjugation: [
      { id: 'it-essere-io-presente', verb: 'essere', tense: 'presente', prompt: 'io ___ italiano', promptFr: 'je suis italien', options: ['sono', 'sei', 'è'], answer: 'sono' },
      { id: 'it-essere-tu-presente', verb: 'essere', tense: 'presente', prompt: 'tu ___ di Roma?', promptFr: 'tu es de Rome ?', options: ['sei', 'sono', 'è'], answer: 'sei' },
    ],
  },
  {
    id: 'it-presentarsi',
    lang: 'it',
    title: 'Presentarsi',
    icon: 'ti-user',
    dialogue: [
      { speaker: 'Marco', target: 'Ciao! Come ti chiami?', fr: 'Salut ! Comment tu t’appelles ?' },
      { speaker: 'Tu', target: 'Mi chiamo Alex. E tu?', fr: 'Je m’appelle Alex. Et toi ?' },
      { speaker: 'Marco', target: 'Io sono Marco. Di dove sei?', fr: 'Moi c’est Marco. D’où es-tu ?' },
      { speaker: 'Tu', target: 'Sono di Parigi.', fr: 'Je suis de Paris.' },
    ],
    vocab: [
      { target: 'mi chiamo', fr: 'je m’appelle' },
      { target: 'di dove sei?', fr: 'd’où es-tu ?' },
    ],
    mcqs: [
      {
        prompt: 'Marco chiede: «Come ti chiami?» Tu rispondi:',
        fr: 'Marco demande : « Comment tu t’appelles ? » Tu réponds :',
        options: [
          { target: 'Mi chiamo Alex.', fr: 'Je m’appelle Alex.', correct: true },
          { target: 'Ho vent’anni.', fr: 'J’ai vingt ans.', correct: false },
          { target: 'Vado al bar.', fr: 'Je vais au bar.', correct: false },
        ],
        hint: 'mi chiamo = ma présentation, pas mon âge ni ma destination',
      },
    ],
    conjugation: [
      { id: 'it-avere-io-presente', verb: 'avere', tense: 'presente', prompt: 'io ___ vent’anni', promptFr: 'j’ai vingt ans', options: ['ho', 'hai', 'ha'], answer: 'ho' },
      { id: 'it-avere-tu-presente', verb: 'avere', tense: 'presente', prompt: 'tu ___ un fratello?', promptFr: 'tu as un frère ?', options: ['hai', 'ho', 'ha'], answer: 'hai' },
      { id: 'it-essere-tu-presente', verb: 'essere', tense: 'presente', prompt: 'tu ___ di Roma?', promptFr: 'tu es de Rome ?', options: ['sei', 'sono', 'è'], answer: 'sei' },
    ],
  },
  {
    id: 'it-indicazioni',
    lang: 'it',
    title: 'Chiedere indicazioni',
    icon: 'ti-map-pin',
    dialogue: [
      { speaker: 'Tu', target: 'Scusi, dov’è la stazione?', fr: 'Excusez-moi, où est la gare ?' },
      { speaker: 'Passante', target: 'È sempre dritto, poi a destra.', fr: 'C’est tout droit, puis à droite.' },
      { speaker: 'Tu', target: 'Grazie mille!', fr: 'Merci beaucoup !' },
      { speaker: 'Passante', target: 'Prego!', fr: 'Je vous en prie !' },
    ],
    vocab: [
      { target: 'dov’è?', fr: 'où est ?' },
      { target: 'sempre dritto', fr: 'tout droit' },
    ],
    mcqs: [
      {
        prompt: 'Vuoi sapere dov’è la stazione. Tu chiedi:',
        fr: 'Tu veux savoir où est la gare. Tu demandes :',
        options: [
          { target: 'Scusi, dov’è la stazione?', fr: 'Excusez-moi, où est la gare ?', correct: true },
          { target: 'Mi chiamo Marco.', fr: 'Je m’appelle Marco.', correct: false },
          { target: 'Vorrei un caffè.', fr: 'Je voudrais un café.', correct: false },
        ],
        hint: 'dov’è = pour localiser quelque chose',
      },
    ],
    conjugation: [
      { id: 'it-andare-io-presente', verb: 'andare', tense: 'presente', prompt: 'io ___ al lavoro', promptFr: 'je vais au travail', options: ['vado', 'vai', 'va'], answer: 'vado' },
      { id: 'it-andare-tu-presente', verb: 'andare', tense: 'presente', prompt: 'tu ___ a piedi?', promptFr: 'tu y vas à pied ?', options: ['vai', 'vado', 'va'], answer: 'vai' },
      { id: 'it-avere-io-presente', verb: 'avere', tense: 'presente', prompt: 'io ___ vent’anni', promptFr: 'j’ai vingt ans', options: ['ho', 'hai', 'ha'], answer: 'ho' },
      { id: 'it-essere-tu-presente', verb: 'essere', tense: 'presente', prompt: 'tu ___ di Roma?', promptFr: 'tu es de Rome ?', options: ['sei', 'sono', 'è'], answer: 'sei' },
    ],
  },
  {
    id: 'it-ristorante',
    lang: 'it',
    title: 'Al ristorante',
    icon: 'ti-tools-kitchen-2',
    dialogue: [
      { speaker: 'Cameriere', target: 'Buonasera, avete prenotato?', fr: 'Bonsoir, avez-vous réservé ?' },
      { speaker: 'Tu', target: 'Sì, un tavolo per due, per favore.', fr: 'Oui, une table pour deux, s’il vous plaît.' },
      { speaker: 'Cameriere', target: 'Perfetto, seguitemi.', fr: 'Parfait, suivez-moi.' },
      { speaker: 'Tu', target: 'Grazie! Vorrei anche il menù.', fr: 'Merci ! Je voudrais aussi le menu.' },
    ],
    vocab: [
      { target: 'avete prenotato?', fr: 'avez-vous réservé ?' },
      { target: 'un tavolo per due', fr: 'une table pour deux' },
    ],
    mcqs: [
      {
        prompt: 'Il cameriere chiede se avete un tavolo prenotato. Tu rispondi:',
        fr: 'Le serveur demande si vous avez réservé une table. Tu réponds :',
        options: [
          { target: 'Sì, un tavolo per due, per favore.', fr: 'Oui, une table pour deux, s’il vous plaît.', correct: true },
          { target: 'Sono di Parigi.', fr: 'Je suis de Paris.', correct: false },
          { target: 'È sempre dritto.', fr: 'C’est tout droit.', correct: false },
        ],
        hint: 'avete prenotato? = question sur la réservation, réponds-y directement',
      },
    ],
    conjugation: [
      { id: 'it-volere-io-presente', verb: 'volere', tense: 'presente', prompt: 'io ___ il conto', promptFr: 'je veux l’addition', options: ['voglio', 'vuoi', 'vuole'], answer: 'voglio' },
      { id: 'it-volere-tu-presente', verb: 'volere', tense: 'presente', prompt: 'tu ___ prenotare?', promptFr: 'tu veux réserver ?', options: ['vuoi', 'voglio', 'vuole'], answer: 'vuoi' },
      { id: 'it-andare-io-presente', verb: 'andare', tense: 'presente', prompt: 'io ___ al lavoro', promptFr: 'je vais au travail', options: ['vado', 'vai', 'va'], answer: 'vado' },
      { id: 'it-avere-tu-presente', verb: 'avere', tense: 'presente', prompt: 'tu ___ un fratello?', promptFr: 'tu as un frère ?', options: ['hai', 'ho', 'ha'], answer: 'hai' },
    ],
  },
  {
    id: 'it-mercato',
    lang: 'it',
    title: 'Al mercato',
    icon: 'ti-shopping-cart',
    dialogue: [
      { speaker: 'Venditore', target: 'Buongiorno! Posso aiutarla?', fr: 'Bonjour ! Je peux vous aider ?' },
      { speaker: 'Tu', target: 'Sì, vorrei un chilo di pomodori.', fr: 'Oui, je voudrais un kilo de tomates.' },
      { speaker: 'Venditore', target: 'Ecco a lei. Altro?', fr: 'Voilà. Autre chose ?' },
      { speaker: 'Tu', target: 'Può darmi anche del basilico?', fr: 'Pouvez-vous aussi me donner du basilic ?' },
    ],
    vocab: [
      { target: 'posso aiutarla?', fr: 'je peux vous aider ?' },
      { target: 'un chilo di', fr: 'un kilo de' },
    ],
    mcqs: [
      {
        prompt: 'Il venditore chiede: «Posso aiutarla?» Tu rispondi:',
        fr: 'Le vendeur demande : « Je peux vous aider ? » Tu réponds :',
        options: [
          { target: 'Sì, vorrei un chilo di pomodori.', fr: 'Oui, je voudrais un kilo de tomates.', correct: true },
          { target: 'Devo andare alla stazione.', fr: 'Je dois aller à la gare.', correct: false },
          { target: 'Sto molto bene, grazie.', fr: 'Je vais très bien, merci.', correct: false },
        ],
        hint: 'On répond à une offre d’aide en disant ce qu’on veut',
      },
    ],
    conjugation: [
      { id: 'it-potere-io-presente', verb: 'potere', tense: 'presente', prompt: 'io ___ pagare con la carta?', promptFr: 'je peux payer par carte ?', options: ['posso', 'puoi', 'può'], answer: 'posso' },
      { id: 'it-potere-tu-presente', verb: 'potere', tense: 'presente', prompt: 'tu ___ aiutarmi?', promptFr: 'tu peux m’aider ?', options: ['puoi', 'posso', 'può'], answer: 'puoi' },
      { id: 'it-andare-io-presente', verb: 'andare', tense: 'presente', prompt: 'io ___ al lavoro', promptFr: 'je vais au travail', options: ['vado', 'vai', 'va'], answer: 'vado' },
      { id: 'it-avere-tu-presente', verb: 'avere', tense: 'presente', prompt: 'tu ___ un fratello?', promptFr: 'tu as un frère ?', options: ['hai', 'ho', 'ha'], answer: 'hai' },
    ],
  },
  {
    id: 'it-trasporti',
    lang: 'it',
    title: 'Ai trasporti',
    icon: 'ti-bus',
    dialogue: [
      { speaker: 'Bigliettaio', target: 'Dove deve andare?', fr: 'Où devez-vous aller ?' },
      { speaker: 'Tu', target: 'Devo andare alla stazione centrale.', fr: 'Je dois aller à la gare centrale.' },
      { speaker: 'Bigliettaio', target: 'Un biglietto costa due euro.', fr: 'Un billet coûte deux euros.' },
      { speaker: 'Tu', target: 'Perfetto, grazie mille.', fr: 'Parfait, merci beaucoup.' },
    ],
    vocab: [
      { target: 'dove deve andare?', fr: 'où devez-vous aller ?' },
      { target: 'un biglietto', fr: 'un billet' },
    ],
    mcqs: [
      {
        prompt: 'Il bigliettaio chiede dove devi andare. Tu rispondi:',
        fr: 'Le contrôleur demande où tu dois aller. Tu réponds :',
        options: [
          { target: 'Devo andare alla stazione centrale.', fr: 'Je dois aller à la gare centrale.', correct: true },
          { target: 'Posso aiutarla?', fr: 'Je peux vous aider ?', correct: false },
          { target: 'Vorrei un chilo di pomodori.', fr: 'Je voudrais un kilo de tomates.', correct: false },
        ],
        hint: 'devo + [destination] = pour dire où on doit aller',
      },
    ],
    conjugation: [
      { id: 'it-dovere-io-presente', verb: 'dovere', tense: 'presente', prompt: 'io ___ partire alle otto', promptFr: 'je dois partir à huit heures', options: ['devo', 'devi', 'deve'], answer: 'devo' },
      { id: 'it-dovere-tu-presente', verb: 'dovere', tense: 'presente', prompt: 'tu ___ cambiare treno?', promptFr: 'tu dois changer de train ?', options: ['devi', 'devo', 'deve'], answer: 'devi' },
      { id: 'it-potere-io-presente', verb: 'potere', tense: 'presente', prompt: 'io ___ pagare con la carta?', promptFr: 'je peux payer par carte ?', options: ['posso', 'puoi', 'può'], answer: 'posso' },
      { id: 'it-volere-tu-presente', verb: 'volere', tense: 'presente', prompt: 'tu ___ prenotare?', promptFr: 'tu veux réserver ?', options: ['vuoi', 'voglio', 'vuole'], answer: 'vuoi' },
    ],
  },
  {
    id: 'it-lavoro',
    lang: 'it',
    title: 'Al lavoro',
    icon: 'ti-briefcase',
    dialogue: [
      { speaker: 'Collega', target: 'Cosa fai di bello oggi?', fr: 'Qu’est-ce que tu fais de beau aujourd’hui ?' },
      { speaker: 'Tu', target: 'Faccio una riunione importante.', fr: 'Je fais une réunion importante.' },
      { speaker: 'Collega', target: 'In bocca al lupo!', fr: 'Bonne chance ! (idiome)' },
      { speaker: 'Tu', target: 'Crepi, grazie!', fr: 'Merci ! (réponse traditionnelle)' },
    ],
    vocab: [
      { target: 'cosa fai?', fr: 'qu’est-ce que tu fais ?' },
      { target: 'in bocca al lupo', fr: 'bonne chance (idiome, littéralement "dans la gueule du loup")' },
    ],
    mcqs: [
      {
        prompt: 'Il collega chiede: «Cosa fai di bello oggi?» Tu rispondi:',
        fr: 'Le collègue demande : « Tu fais quoi de beau aujourd’hui ? » Tu réponds :',
        options: [
          { target: 'Faccio una riunione importante.', fr: 'J’ai une réunion importante.', correct: true },
          { target: 'Devo partire alle otto.', fr: 'Je dois partir à huit heures.', correct: false },
          { target: 'Posso aiutarla?', fr: 'Je peux vous aider ?', correct: false },
        ],
        hint: 'faccio = je fais, pour décrire une activité en cours',
      },
    ],
    conjugation: [
      { id: 'it-fare-io-presente', verb: 'fare', tense: 'presente', prompt: 'io ___ colazione presto', promptFr: 'je prends le petit-déjeuner tôt', options: ['faccio', 'fai', 'fa'], answer: 'faccio' },
      { id: 'it-fare-tu-presente', verb: 'fare', tense: 'presente', prompt: 'tu ___ sport?', promptFr: 'tu fais du sport ?', options: ['fai', 'faccio', 'fa'], answer: 'fai' },
      { id: 'it-dovere-io-presente', verb: 'dovere', tense: 'presente', prompt: 'io ___ partire alle otto', promptFr: 'je dois partir à huit heures', options: ['devo', 'devi', 'deve'], answer: 'devo' },
      { id: 'it-volere-io-presente', verb: 'volere', tense: 'presente', prompt: 'io ___ il conto', promptFr: 'je veux l’addition', options: ['voglio', 'vuoi', 'vuole'], answer: 'voglio' },
    ],
  },
  {
    id: 'it-medico',
    lang: 'it',
    title: 'Dal medico',
    icon: 'ti-stethoscope',
    dialogue: [
      { speaker: 'Dottore', target: 'Come sta oggi?', fr: 'Comment allez-vous aujourd’hui ?' },
      { speaker: 'Tu', target: 'Non sto molto bene, ho mal di testa.', fr: 'Je ne vais pas très bien, j’ai mal à la tête.' },
      { speaker: 'Dottore', target: 'Da quanto tempo sta così?', fr: 'Depuis combien de temps êtes-vous comme ça ?' },
      { speaker: 'Tu', target: 'Sto così da due giorni.', fr: 'Je suis comme ça depuis deux jours.' },
    ],
    vocab: [
      { target: 'come sta?', fr: 'comment allez-vous ?' },
      { target: 'ho mal di testa', fr: 'j’ai mal à la tête' },
    ],
    mcqs: [
      {
        prompt: 'Il dottore chiede: «Come sta oggi?» Tu rispondi:',
        fr: 'Le médecin demande : « Comment allez-vous aujourd’hui ? » Tu réponds :',
        options: [
          { target: 'Non sto molto bene, ho mal di testa.', fr: 'Je ne vais pas très bien, j’ai mal à la tête.', correct: true },
          { target: 'Faccio una riunione importante.', fr: 'J’ai une réunion importante.', correct: false },
          { target: 'Un biglietto costa due euro.', fr: 'Un billet coûte deux euros.', correct: false },
        ],
        hint: 'sto bene/male = pour décrire son état de santé du moment',
      },
    ],
    conjugation: [
      { id: 'it-stare-io-presente', verb: 'stare', tense: 'presente', prompt: 'io non ___ bene', promptFr: 'je ne vais pas bien', options: ['sto', 'stai', 'sta'], answer: 'sto' },
      { id: 'it-stare-tu-presente', verb: 'stare', tense: 'presente', prompt: 'tu ___ meglio oggi?', promptFr: 'tu vas mieux aujourd’hui ?', options: ['stai', 'sto', 'sta'], answer: 'stai' },
      { id: 'it-fare-io-presente', verb: 'fare', tense: 'presente', prompt: 'io ___ colazione presto', promptFr: 'je prends le petit-déjeuner tôt', options: ['faccio', 'fai', 'fa'], answer: 'faccio' },
      { id: 'it-essere-io-presente', verb: 'essere', tense: 'presente', prompt: 'io ___ italiano', promptFr: 'je suis italien', options: ['sono', 'sei', 'è'], answer: 'sono' },
    ],
  },
]
