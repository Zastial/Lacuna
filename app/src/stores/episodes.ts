import { defineStore } from 'pinia'

import { listEpisodes } from '../api/client'
import { getDownloadedEpisodes } from '../db/repository'
import { downloadEpisode } from '../services/download'
import type { ApiEpisode, LocalEpisode } from '../types/models'

interface EpisodesState {
  remote: ApiEpisode[]
  downloaded: LocalEpisode[]
  loadingRemote: boolean
  downloadingId: number | null
  downloadProgress: number
  error: string | null
}

export const useEpisodesStore = defineStore('episodes', {
  state: (): EpisodesState => ({
    remote: [],
    downloaded: [],
    loadingRemote: false,
    downloadingId: null,
    downloadProgress: 0,
    error: null,
  }),

  actions: {
    async refreshDownloaded(): Promise<void> {
      this.downloaded = await getDownloadedEpisodes()
    },

    async fetchRemote(lang?: string): Promise<void> {
      this.loadingRemote = true
      this.error = null
      try {
        this.remote = await listEpisodes(lang ? { lang } : {})
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
      } finally {
        this.loadingRemote = false
      }
    },

    async download(episode: ApiEpisode): Promise<LocalEpisode> {
      this.downloadingId = episode.id
      this.downloadProgress = 0
      this.error = null
      try {
        const local = await downloadEpisode(episode, (ratio) => {
          this.downloadProgress = ratio
        })
        await this.refreshDownloaded()
        return local
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
        throw err
      } finally {
        this.downloadingId = null
      }
    },
  },
})
