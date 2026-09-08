import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'

// Sports proposés = ceux pour lesquels un flux L'Équipe est ingéré côté
// backend (cf. cmd/ingester/seed_articles.go). La valeur est celle stockée
// en base dans article_feed.sport.
export const SPORTS = [
  { id: 'football', label: 'Football' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'rugby', label: 'Rugby' },
  { id: 'cyclisme', label: 'Cyclisme' },
  { id: 'basket', label: 'Basket' },
  { id: 'formule-1', label: 'Formule 1' },
  { id: 'handball', label: 'Handball' },
  { id: 'athlétisme', label: 'Athlétisme' },
  { id: 'volley', label: 'Volley' },
] as const

// Centres d'intérêt : ils décident des chaînes YouTube proposées. La valeur
// est celle stockée en base dans video_channel.category.
export const CATEGORIES = [
  { id: 'langue', label: 'Apprendre la langue', icon: '💬' },
  { id: 'sport', label: 'Sport', icon: '⚽️' },
  { id: 'musique', label: 'Musique', icon: '🎧' },
  { id: 'informatique', label: 'Informatique', icon: '💻' },
] as const

const KEY = 'lacuna.settings'

// applyTheme pose l'attribut lu par style.css. 'auto' le retire plutôt que
// d'écrire une valeur : c'est l'absence d'attribut qui laisse la main à
// prefers-color-scheme, une valeur figée l'écraserait.
export function applyTheme(theme: ThemeChoice): void {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

// 'auto' suit le réglage du système ; les deux autres l'ignorent.
export type ThemeChoice = 'auto' | 'light' | 'dark'

export interface SettingsState {
  theme: ThemeChoice
  // Faux tant que l'onboarding n'a pas été terminé une fois.
  onboarded: boolean
  categories: string[]
  // Langue dans laquelle les notifications sont traduites.
  targetLang: string
  sports: string[]
  notifySport: boolean
  notifyPhrase: boolean
  notifyReview: boolean
  // Heure de la notification quotidienne (0-23).
  notifyHour: number
  loaded: boolean
}

const DEFAULTS: Omit<SettingsState, 'loaded'> = {
  theme: 'auto',
  onboarded: false,
  // Par défaut tout est coché : sans choix, mieux vaut trop de contenu que
  // pas de contenu du tout. L'onboarding remplace ça par un vrai choix.
  categories: ['langue', 'sport', 'musique', 'informatique'],
  targetLang: 'it',
  sports: ['football'],
  notifySport: true,
  notifyPhrase: true,
  notifyReview: true,
  notifyHour: 9,
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({ ...DEFAULTS, loaded: false }),

  actions: {
    async load(): Promise<void> {
      const { value } = await Preferences.get({ key: KEY })
      if (value) {
        try {
          // Fusion avec les défauts : un réglage ajouté après coup ne doit
          // pas rester undefined chez quelqu'un qui a déjà sauvegardé.
          Object.assign(this, DEFAULTS, JSON.parse(value) as Partial<SettingsState>)
        } catch {
          // préférences illisibles : on repart des défauts
        }
      }
      applyTheme(this.theme)
      this.loaded = true
    },

    async save(): Promise<void> {
      const {
        theme,
        onboarded,
        categories,
        targetLang,
        sports,
        notifySport,
        notifyPhrase,
        notifyReview,
        notifyHour,
      } = this
      await Preferences.set({
        key: KEY,
        value: JSON.stringify({
          theme,
          onboarded,
          categories,
          targetLang,
          sports,
          notifySport,
          notifyPhrase,
          notifyReview,
          notifyHour,
        }),
      })
    },

    async toggleCategory(id: string): Promise<void> {
      this.categories = this.categories.includes(id)
        ? this.categories.filter((c) => c !== id)
        : [...this.categories, id]
      await this.save()
    },

    async completeOnboarding(): Promise<void> {
      this.onboarded = true
      await this.save()
    },

    async setTheme(theme: ThemeChoice): Promise<void> {
      this.theme = theme
      applyTheme(theme)
      await this.save()
    },

    async setTargetLang(lang: string): Promise<void> {
      this.targetLang = lang
      await this.save()
    },

    async toggleSport(id: string): Promise<void> {
      this.sports = this.sports.includes(id)
        ? this.sports.filter((s) => s !== id)
        : [...this.sports, id]
      await this.save()
    },

    async setFlag(key: 'notifySport' | 'notifyPhrase' | 'notifyReview', value: boolean): Promise<void> {
      this[key] = value
      await this.save()
    },

    async setHour(hour: number): Promise<void> {
      this.notifyHour = hour
      await this.save()
    },
  },
})
