import { defineStore } from 'pinia'

import { listVideos } from '../api/client'
import { useSettingsStore } from './settings'
import type { ApiVideo } from '../types/models'

const DAILY_LIMIT = 24

interface VideosState {
  videos: ApiVideo[]
  loading: boolean
  error: string | null
}

export const useVideosStore = defineStore('videos', {
  state: (): VideosState => ({
    videos: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetch(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const settings = useSettingsStore()
        if (!settings.loaded) await settings.load()
        this.videos = await listVideos({
          langs: settings.langs,
          categories: settings.categories,
          limit: DAILY_LIMIT,
        })
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
      } finally {
        this.loading = false
      }
    },
  },
})
