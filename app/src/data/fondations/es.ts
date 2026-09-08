import type { Scenario } from '../../types/models'

export const ES_SCENARIOS: Scenario[] = [
  {
    id: 'es-cafe',
    lang: 'es',
    title: 'En el café',
    icon: 'ti-coffee',
    dialogue: [
      { speaker: 'Camarero', target: '¡Buenos días! ¿Qué desea?', fr: 'Bonjour ! Que désirez-vous ?' },
      { speaker: 'Tú', target: 'Quería un café, por favor.', fr: 'Je voudrais un café, s’il vous plaît.' },
      { speaker: 'Camarero', target: 'Claro. ¿Algo más?', fr: 'Bien sûr. Autre chose ?' },
      { speaker: 'Tú', target: 'No gracias, eso es todo.', fr: 'Non merci, c’est tout.' },
    ],
    vocab: [
      { target: 'quería', fr: 'je voudrais (formule polie)' },
      { target: 'por favor', fr: 's’il vous plaît' },
    ],
    mcqs: [
      {
        prompt: 'El camarero pregunta: «¿Qué desea?» Tú respondes:',
        options: [
          { target: 'Quería un café, por favor.', correct: true },
          { target: 'Me llamo Alex.', correct: false },
          { target: 'Son las tres.', correct: false },
        ],
        hint: 'quería + [chose] = façon polie de commander',
      },
    ],
    conjugation: [
      { id: 'es-ser-yo-presente', verb: 'ser', tense: 'presente', prompt: 'yo ___ de Francia', options: ['soy', 'eres', 'es'], answer: 'soy' },
      { id: 'es-ser-tu-presente', verb: 'ser', tense: 'presente', prompt: 'tú ___ español?', options: ['eres', 'soy', 'es'], answer: 'eres' },
    ],
  },
  {
    id: 'es-presentarse',
    lang: 'es',
    title: 'Presentarse',
    icon: 'ti-user',
    dialogue: [
      { speaker: 'Ana', target: '¡Hola! ¿Cómo te llamas?', fr: 'Salut ! Comment tu t’appelles ?' },
      { speaker: 'Tú', target: 'Me llamo Alex. ¿Y tú?', fr: 'Je m’appelle Alex. Et toi ?' },
      { speaker: 'Ana', target: 'Yo soy Ana. ¿Cómo estás?', fr: 'Moi c’est Ana. Comment vas-tu ?' },
      { speaker: 'Tú', target: 'Estoy muy bien, gracias.', fr: 'Je vais très bien, merci.' },
    ],
    vocab: [
      { target: 'me llamo', fr: 'je m’appelle' },
      { target: '¿cómo estás?', fr: 'comment vas-tu ? (état passager)' },
    ],
    mcqs: [
      {
        prompt: 'Ana te pregunta: «¿Cómo estás?» (no quién eres). Tú respondes:',
        options: [
          { target: 'Estoy muy bien, gracias.', correct: true },
          { target: 'Soy de España.', correct: false },
          { target: 'Voy al bar.', correct: false },
        ],
        hint: 'estar = état du moment, ser = identité — ici on te demande comment tu vas',
      },
    ],
    conjugation: [
      { id: 'es-estar-yo-presente', verb: 'estar', tense: 'presente', prompt: 'yo ___ cansado hoy', options: ['estoy', 'estás', 'está'], answer: 'estoy' },
      { id: 'es-estar-tu-presente', verb: 'estar', tense: 'presente', prompt: 'tú ___ bien?', options: ['estás', 'estoy', 'está'], answer: 'estás' },
      { id: 'es-ser-tu-presente', verb: 'ser', tense: 'presente', prompt: 'tú ___ español?', options: ['eres', 'soy', 'es'], answer: 'eres' },
    ],
  },
  {
    id: 'es-direcciones',
    lang: 'es',
    title: 'Preguntar direcciones',
    icon: 'ti-map-pin',
    dialogue: [
      { speaker: 'Tú', target: 'Perdona, ¿dónde está la estación?', fr: 'Excuse-moi, où est la gare ?' },
      { speaker: 'Transeúnte', target: 'Todo recto, luego a la derecha.', fr: 'Tout droit, puis à droite.' },
      { speaker: 'Tú', target: '¡Muchas gracias!', fr: 'Merci beaucoup !' },
      { speaker: 'Transeúnte', target: '¡De nada!', fr: 'De rien !' },
    ],
    vocab: [
      { target: '¿dónde está?', fr: 'où est ? (localisation, estar)' },
      { target: 'todo recto', fr: 'tout droit' },
    ],
    mcqs: [
      {
        prompt: 'Quieres saber dónde está la estación. Preguntas:',
        options: [
          { target: 'Perdona, ¿dónde está la estación?', correct: true },
          { target: 'Me llamo Alex.', correct: false },
          { target: 'Quería un café.', correct: false },
        ],
        hint: '¿dónde está? = pour localiser quelque chose',
      },
    ],
    conjugation: [
      { id: 'es-ir-yo-presente', verb: 'ir', tense: 'presente', prompt: 'yo ___ al trabajo', options: ['voy', 'vas', 'va'], answer: 'voy' },
      { id: 'es-ir-tu-presente', verb: 'ir', tense: 'presente', prompt: 'tú ___ a pie?', options: ['vas', 'voy', 'va'], answer: 'vas' },
      { id: 'es-estar-yo-presente', verb: 'estar', tense: 'presente', prompt: 'yo ___ cansado hoy', options: ['estoy', 'estás', 'está'], answer: 'estoy' },
      { id: 'es-ser-tu-presente', verb: 'ser', tense: 'presente', prompt: 'tú ___ español?', options: ['eres', 'soy', 'es'], answer: 'eres' },
    ],
  },
  {
    id: 'es-restaurante',
    lang: 'es',
    title: 'En el restaurante',
    icon: 'ti-tools-kitchen-2',
    dialogue: [
      { speaker: 'Camarero', target: 'Buenas noches, ¿tienen reserva?', fr: 'Bonsoir, avez-vous réservé ?' },
      { speaker: 'Tú', target: 'Sí, una mesa para dos, por favor.', fr: 'Oui, une table pour deux, s’il vous plaît.' },
      { speaker: 'Camarero', target: 'Perfecto, síganme.', fr: 'Parfait, suivez-moi.' },
      { speaker: 'Tú', target: 'Gracias, quiero ver la carta también.', fr: 'Merci, je voudrais aussi voir la carte.' },
    ],
    vocab: [
      { target: '¿tienen reserva?', fr: 'avez-vous réservé ?' },
      { target: 'una mesa para dos', fr: 'une table pour deux' },
    ],
    mcqs: [
      {
        prompt: 'El camarero pregunta si tenéis mesa reservada. Tú respondes:',
        options: [
          { target: 'Sí, una mesa para dos, por favor.', correct: true },
          { target: 'Soy de Francia.', correct: false },
          { target: 'Todo recto.', correct: false },
        ],
        hint: '¿tienen reserva? = question sur la réservation, réponds-y directement',
      },
    ],
    conjugation: [
      { id: 'es-querer-yo-presente', verb: 'querer', tense: 'presente', prompt: 'yo ___ la cuenta', options: ['quiero', 'quieres', 'quiere'], answer: 'quiero' },
      { id: 'es-querer-tu-presente', verb: 'querer', tense: 'presente', prompt: 'tú ___ reservar?', options: ['quieres', 'quiero', 'quiere'], answer: 'quieres' },
      { id: 'es-ir-yo-presente', verb: 'ir', tense: 'presente', prompt: 'yo ___ al trabajo', options: ['voy', 'vas', 'va'], answer: 'voy' },
      { id: 'es-estar-tu-presente', verb: 'estar', tense: 'presente', prompt: 'tú ___ bien?', options: ['estás', 'estoy', 'está'], answer: 'estás' },
    ],
  },
  {
    id: 'es-mercado',
    lang: 'es',
    title: 'En el mercado',
    icon: 'ti-shopping-cart',
    dialogue: [
      { speaker: 'Vendedor', target: '¡Buenos días! ¿Puedo ayudarle?', fr: 'Bonjour ! Je peux vous aider ?' },
      { speaker: 'Tú', target: 'Sí, quería un kilo de tomates.', fr: 'Oui, je voudrais un kilo de tomates.' },
      { speaker: 'Vendedor', target: 'Aquí tiene. ¿Algo más?', fr: 'Voilà. Autre chose ?' },
      { speaker: 'Tú', target: '¿Puede darme también albahaca?', fr: 'Pouvez-vous aussi me donner du basilic ?' },
    ],
    vocab: [
      { target: '¿puedo ayudarle?', fr: 'je peux vous aider ?' },
      { target: 'un kilo de', fr: 'un kilo de' },
    ],
    mcqs: [
      {
        prompt: 'El vendedor pregunta: «¿Puedo ayudarle?» Tú respondes:',
        options: [
          { target: 'Sí, quería un kilo de tomates.', correct: true },
          { target: 'Tengo que ir a la estación.', correct: false },
          { target: 'Estoy muy bien, gracias.', correct: false },
        ],
        hint: 'On répond à une offre d’aide en disant ce qu’on veut',
      },
    ],
    conjugation: [
      { id: 'es-poder-yo-presente', verb: 'poder', tense: 'presente', prompt: 'yo ___ pagar con tarjeta?', options: ['puedo', 'puedes', 'puede'], answer: 'puedo' },
      { id: 'es-poder-tu-presente', verb: 'poder', tense: 'presente', prompt: 'tú ___ ayudarme?', options: ['puedes', 'puedo', 'puede'], answer: 'puedes' },
      { id: 'es-querer-yo-presente', verb: 'querer', tense: 'presente', prompt: 'yo ___ la cuenta', options: ['quiero', 'quieres', 'quiere'], answer: 'quiero' },
      { id: 'es-ir-tu-presente', verb: 'ir', tense: 'presente', prompt: 'tú ___ a pie?', options: ['vas', 'voy', 'va'], answer: 'vas' },
    ],
  },
  {
    id: 'es-transporte',
    lang: 'es',
    title: 'En el transporte',
    icon: 'ti-bus',
    dialogue: [
      { speaker: 'Revisor', target: '¿A dónde tiene que ir?', fr: 'Où devez-vous aller ?' },
      { speaker: 'Tú', target: 'Tengo que ir a la estación central.', fr: 'Je dois aller à la gare centrale.' },
      { speaker: 'Revisor', target: 'Un billete cuesta dos euros.', fr: 'Un billet coûte deux euros.' },
      { speaker: 'Tú', target: 'Perfecto, muchas gracias.', fr: 'Parfait, merci beaucoup.' },
    ],
    vocab: [
      { target: 'tener que', fr: 'devoir' },
      { target: 'un billete', fr: 'un billet' },
    ],
    mcqs: [
      {
        prompt: 'El revisor pregunta a dónde tienes que ir. Tú respondes:',
        options: [
          { target: 'Tengo que ir a la estación central.', correct: true },
          { target: '¿Puedo ayudarle?', correct: false },
          { target: 'Quería un kilo de tomates.', correct: false },
        ],
        hint: 'tengo que + [destination] = pour dire où on doit aller',
      },
    ],
    conjugation: [
      { id: 'es-tener-yo-presente', verb: 'tener', tense: 'presente', prompt: 'yo ___ prisa', options: ['tengo', 'tienes', 'tiene'], answer: 'tengo' },
      { id: 'es-tener-tu-presente', verb: 'tener', tense: 'presente', prompt: 'tú ___ hambre?', options: ['tienes', 'tengo', 'tiene'], answer: 'tienes' },
      { id: 'es-poder-yo-presente', verb: 'poder', tense: 'presente', prompt: 'yo ___ pagar con tarjeta?', options: ['puedo', 'puedes', 'puede'], answer: 'puedo' },
      { id: 'es-estar-yo-presente', verb: 'estar', tense: 'presente', prompt: 'yo ___ cansado hoy', options: ['estoy', 'estás', 'está'], answer: 'estoy' },
    ],
  },
  {
    id: 'es-trabajo',
    lang: 'es',
    title: 'En el trabajo',
    icon: 'ti-briefcase',
    dialogue: [
      { speaker: 'Compañero', target: '¿Qué haces hoy?', fr: 'Qu’est-ce que tu fais aujourd’hui ?' },
      { speaker: 'Tú', target: 'Hago una reunión importante.', fr: 'Je fais une réunion importante.' },
      { speaker: 'Compañero', target: '¡Mucha suerte!', fr: 'Bonne chance !' },
      { speaker: 'Tú', target: '¡Gracias!', fr: 'Merci !' },
    ],
    vocab: [
      { target: '¿qué haces?', fr: 'qu’est-ce que tu fais ?' },
      { target: 'mucha suerte', fr: 'bonne chance' },
    ],
    mcqs: [
      {
        prompt: 'El compañero pregunta: «¿Qué haces hoy?» Tú respondes:',
        options: [
          { target: 'Hago una reunión importante.', correct: true },
          { target: 'Tengo que salir a las ocho.', correct: false },
          { target: '¿Puedo ayudarle?', correct: false },
        ],
        hint: 'hago = je fais, pour décrire une activité en cours',
      },
    ],
    conjugation: [
      { id: 'es-hacer-yo-presente', verb: 'hacer', tense: 'presente', prompt: 'yo ___ deporte los lunes', options: ['hago', 'haces', 'hace'], answer: 'hago' },
      { id: 'es-hacer-tu-presente', verb: 'hacer', tense: 'presente', prompt: 'tú ___ ejercicio?', options: ['haces', 'hago', 'hace'], answer: 'haces' },
      { id: 'es-tener-yo-presente', verb: 'tener', tense: 'presente', prompt: 'yo ___ prisa', options: ['tengo', 'tienes', 'tiene'], answer: 'tengo' },
      { id: 'es-ser-yo-presente', verb: 'ser', tense: 'presente', prompt: 'yo ___ de Francia', options: ['soy', 'eres', 'es'], answer: 'soy' },
    ],
  },
  {
    id: 'es-medico',
    lang: 'es',
    title: 'En el médico',
    icon: 'ti-stethoscope',
    dialogue: [
      { speaker: 'Doctor', target: '¿Cómo se encuentra hoy?', fr: 'Comment vous sentez-vous aujourd’hui ?' },
      { speaker: 'Tú', target: 'No me encuentro muy bien, me duele la cabeza.', fr: 'Je ne me sens pas très bien, j’ai mal à la tête.' },
      { speaker: 'Doctor', target: 'Debe descansar unos días.', fr: 'Vous devez vous reposer quelques jours.' },
      { speaker: 'Tú', target: 'Debo trabajar mañana, doctor.', fr: 'Je dois travailler demain, docteur.' },
    ],
    vocab: [
      { target: '¿cómo se encuentra?', fr: 'comment vous sentez-vous ?' },
      { target: 'me duele la cabeza', fr: 'j’ai mal à la tête' },
    ],
    mcqs: [
      {
        prompt: 'El doctor pregunta: «¿Cómo se encuentra hoy?» Tú respondes:',
        options: [
          { target: 'No me encuentro muy bien, me duele la cabeza.', correct: true },
          { target: 'Hago una reunión importante.', correct: false },
          { target: 'Un billete cuesta dos euros.', correct: false },
        ],
        hint: 'me duele... = pour décrire une douleur du moment',
      },
    ],
    conjugation: [
      { id: 'es-deber-yo-presente', verb: 'deber', tense: 'presente', prompt: 'yo ___ descansar', options: ['debo', 'debes', 'debe'], answer: 'debo' },
      { id: 'es-deber-tu-presente', verb: 'deber', tense: 'presente', prompt: 'tú ___ tomar esta pastilla', options: ['debes', 'debo', 'debe'], answer: 'debes' },
      { id: 'es-hacer-yo-presente', verb: 'hacer', tense: 'presente', prompt: 'yo ___ deporte los lunes', options: ['hago', 'haces', 'hace'], answer: 'hago' },
      { id: 'es-querer-tu-presente', verb: 'querer', tense: 'presente', prompt: 'tú ___ reservar?', options: ['quieres', 'quiero', 'quiere'], answer: 'quieres' },
    ],
  },
]
