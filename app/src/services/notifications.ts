// Notifications locales : Lacuna s'envoie ses propres notifications, avec du
// contenu déjà bilingue. iOS n'autorise aucune app à lire les notifications
// des autres (pas d'équivalent au NotificationListenerService d'Android),
// c'est donc la seule voie possible pour recevoir des traductions au fil de
// la journée.
import { LocalNotifications } from '@capacitor/local-notifications'

import { listArticles } from '../api/client'
import { scenariosForLang } from '../data/fondations'
import { countDueCultureItems, getDueVocabItems } from '../db/repository'
import { NATIVE_LANG, translateFromNative, translationStatus } from './translate'
import type { SettingsState } from '../stores/settings'

// Ids fixes par type : reprogrammer écrase la notification précédente au
// lieu d'en empiler une nouvelle à chaque ouverture de l'app.
const ID_PHRASE = 1001
const ID_REVIEW = 1002
const ID_SPORT = 1003

const ID_PREVIEW = 1004

export async function ensurePermission(): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  const asked = await LocalNotifications.requestPermissions()
  return asked.display === 'granted'
}

// phraseOfTheDay tire une réplique de scénario du jour. Le tirage dépend de
// la date : la phrase reste la même toute la journée, et change demain.
export function phraseOfTheDay(lang: string, dayIndex: number): { target: string; fr: string } | null {
  const lines = scenariosForLang(lang).flatMap((s) => s.dialogue)
  if (lines.length === 0) return null
  const line = lines[dayIndex % lines.length]
  return { target: line.target, fr: line.fr }
}

// langOfDay fait tourner les langues suivies d'un jour à l'autre. Envoyer
// une notification par langue en doublerait le nombre pour un gain nul :
// l'alternance donne les deux sans jamais empiler.
function langOfDay(langs: string[], day: number): string | null {
  if (langs.length === 0) return null
  return langs[day % langs.length]
}

function dayIndex(): number {
  return Math.floor(Date.now() / 86_400_000)
}

function nextOccurrence(hour: number): Date {
  const at = new Date()
  at.setHours(hour, 0, 0, 0)
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1)
  return at
}

// syncNotifications reprogramme tout à partir des réglages courants. Appelée
// au démarrage et après chaque changement de réglage — c'est plus simple et
// plus sûr que de tenter des mises à jour incrémentales.
export async function syncNotifications(settings: SettingsState): Promise<void> {
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: ID_PHRASE }, { id: ID_REVIEW }, { id: ID_SPORT }],
    })

    if (!(await ensurePermission())) return

    const at = nextOccurrence(settings.notifyHour)
    const notifications = []

    const day = dayIndex()
    const lang = langOfDay(settings.langs, day)

    if (settings.notifyPhrase && lang) {
      const phrase = phraseOfTheDay(lang, day)
      if (phrase) {
        notifications.push({
          id: ID_PHRASE,
          title: phrase.target,
          body: phrase.fr,
          schedule: { at, repeats: true, every: 'day' as const },
        })
      }
    }

    if (settings.notifyReview) {
      // Les segments audio ont disparu avec le mode podcast : ce qui reste
      // à réviser, ce sont les formes verbales de Fondations et les
      // questions de Culture G, chacune avec sa propre file FSRS.
      // Somme sur toutes les langues suivies : la file de révision ne se
      // scinde pas par langue du point de vue de l'utilisateur.
      const now = Date.now()
      const counts = await Promise.all(
        settings.langs.map(async (l) => {
          const [vocab, culture] = await Promise.all([
            getDueVocabItems(l, now, 500),
            countDueCultureItems(l, now),
          ])
          return vocab.length + culture
        }),
      )
      const due = counts.reduce((a, b) => a + b, 0)
      if (due > 0) {
        notifications.push({
          id: ID_REVIEW,
          title: 'Révision',
          body: `${due} carte${due > 1 ? 's' : ''} t'attend${due > 1 ? 'ent' : ''}.`,
          schedule: { at, repeats: true, every: 'day' as const },
        })
      }
    }

    if (settings.notifySport) {
      const sport = await sportHeadline(settings)
      if (sport) {
        notifications.push({
          id: ID_SPORT,
          title: sport.translated,
          body: sport.original,
          schedule: { at, repeats: true, every: 'day' as const },
        })
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
    }
  } catch {
    // Les notifications sont un confort : un refus de permission ou une
    // plateforme sans support ne doit jamais empêcher l'app de tourner.
  }
}

// sendPreview envoie tout de suite la notification du jour. Une notification
// quotidienne est invérifiable autrement : sans ça, il faut attendre le
// lendemain matin pour savoir si les réglages ont pris et si l'autorisation
// système est bien accordée.
export async function sendPreview(settings: SettingsState): Promise<'ok' | 'denied' | 'empty'> {
  if (!(await ensurePermission())) return 'denied'

  const day = dayIndex()
  const lang = langOfDay(settings.langs, day)
  if (!lang) return 'empty'

  const phrase = phraseOfTheDay(lang, day)
  if (!phrase) return 'empty'

  await LocalNotifications.cancel({ notifications: [{ id: ID_PREVIEW }] })
  await LocalNotifications.schedule({
    notifications: [
      {
        id: ID_PREVIEW,
        title: phrase.target,
        body: phrase.fr,
        schedule: { at: new Date(Date.now() + 3000) },
      },
    ],
  })
  return 'ok'
}

// sportHeadline prend le titre L'Équipe du jour dans les rubriques choisies
// et le rend dans la langue cible. La valeur pédagogique tient précisément
// au fait que la source est en français : le sens est déjà connu, ce qui
// reste à apprendre c'est la façon de le dire.
//
// Sans moteur de traduction disponible (Simulateur, iOS < 18, modèle non
// téléchargé), on renvoie null : mieux vaut pas de notification sportive
// qu'une notification en français, qui n'apprendrait rien.
async function sportHeadline(
  settings: SettingsState,
): Promise<{ translated: string; original: string } | null> {
  if (settings.sports.length === 0) return null

  const target = langOfDay(settings.langs, dayIndex())
  if (!target) return null

  // Vérifier le moteur avant d'appeler l'API : sans traduction possible, la
  // notification ne partira pas, autant ne pas faire la requête réseau.
  if ((await translationStatus(target)) !== 'installed') return null

  const articles = await listArticles({ langs: [NATIVE_LANG], sports: settings.sports, limit: 1 })
  const headline = articles[0]?.title
  if (!headline) return null

  const translated = await translateFromNative(headline, target)
  if (!translated) return null

  return { translated, original: headline }
}
