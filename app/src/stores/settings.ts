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
] as const

const KEY = 'lacuna.settings'

export interface SettingsState {
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
      this.loaded = true
    },

    async save(): Promise<void> {
      const { targetLang, sports, notifySport, notifyPhrase, notifyReview, notifyHour } = this
      await Preferences.set({
        key: KEY,
        value: JSON.stringify({ targetLang, sports, notifySport, notifyPhrase, notifyReview, notifyHour }),
      })
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
