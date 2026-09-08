import { defineStore } from 'pinia'

import { listArticles } from '../api/client'
import { useSettingsStore } from './settings'
import type { ApiArticle } from '../types/models'

const DAILY_LIMIT = 6

interface ArticlesState {
  lang: string
  articles: ApiArticle[]
  loading: boolean
  error: string | null
  current: ApiArticle | null
}

export const useArticlesStore = defineStore('articles', {
  state: (): ArticlesState => ({
    lang: 'it',
    articles: [],
    loading: false,
    error: null,
    current: null,
  }),

  actions: {
    async setLang(lang: string): Promise<void> {
      this.lang = lang
      await this.fetch()
    },

    // fetch : "chaque jour, quelques articles" — on ne prend que les plus
    // récents (DAILY_LIMIT), pas tout l'historique du flux, pour que ça
    // reste une sélection du jour et pas une liste qui grossit sans fin.
    async fetch(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        // Le filtre sport ne s'applique qu'aux flux français (L'Équipe) :
        // les flux es/it sont généralistes et n'ont pas de rubrique.
        const settings = useSettingsStore()
        if (this.lang === 'fr' && !settings.loaded) await settings.load()
        const sports = this.lang === 'fr' ? settings.sports : []
        this.articles = await listArticles({ langs: [this.lang], limit: DAILY_LIMIT, sports })
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
      } finally {
        this.loading = false
      }
    },

    open(article: ApiArticle): void {
      this.current = article
    },

    close(): void {
      this.current = null
    },
  },
})
