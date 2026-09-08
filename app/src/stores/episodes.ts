import { defineStore } from 'pinia'
import { Directory, Filesystem } from '@capacitor/filesystem'

import { listEpisodes, listFeeds } from '../api/client'
import { deleteEpisode as deleteEpisodeFromDB, getDownloadedEpisodes, saveEpisode } from '../db/repository'
import { downloadEpisode } from '../services/download'
import type { ApiEpisode, ApiFeed, LocalEpisode } from '../types/models'

interface EpisodesState {
  remote: ApiEpisode[]
  feeds: ApiFeed[]
  downloaded: LocalEpisode[]
  loadingRemote: boolean
  downloadingId: number | null
  downloadProgress: number
  error: string | null
}

export const useEpisodesStore = defineStore('episodes', {
  state: (): EpisodesState => ({
    remote: [],
    feeds: [],
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
        const [episodes, feeds] = await Promise.all([listEpisodes(lang ? { lang } : {}), listFeeds()])
        this.remote = episodes
        this.feeds = feeds
        await this.backfillEpisodeMetadata()
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
      } finally {
        this.loadingRemote = false
      }
    },

    // Répare les épisodes téléchargés avant l'ajout des colonnes lang/level
    // (migration ALTER TABLE ... DEFAULT '') : sans lang/level, buildCloze()
    // ne trouve aucune liste de fréquence et masque tous les mots du segment.
    async backfillEpisodeMetadata(): Promise<void> {
      const toFix = this.downloaded.filter((e) => !e.lang)
      if (toFix.length === 0) return
      for (const episode of toFix) {
        const feed = this.feeds.find((f) => f.id === episode.feedId)
        if (!feed) continue
        const fixed = { ...episode, lang: feed.lang, level: feed.level }
        await saveEpisode(fixed)
      }
      await this.refreshDownloaded()
    },

    async download(episode: ApiEpisode): Promise<LocalEpisode> {
      const feed = this.feeds.find((f) => f.id === episode.feed_id)
      if (!feed) throw new Error(`feed ${episode.feed_id} introuvable (rafraîchir la liste ?)`)

      this.downloadingId = episode.id
      this.downloadProgress = 0
      this.error = null
      try {
        const local = await downloadEpisode(episode, feed, (ratio) => {
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

    async remove(episodeId: number): Promise<void> {
      const relativePath = await deleteEpisodeFromDB(episodeId)
      if (relativePath) {
        await Filesystem.deleteFile({ path: relativePath, directory: Directory.Data }).catch(() => {
          // fichier déjà absent : pas bloquant, la ligne DB est déjà nettoyée
        })
      }
      await this.refreshDownloaded()
    },
  },
})
