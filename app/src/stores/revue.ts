import { defineStore } from 'pinia'

import { EpisodePlayer } from '../services/audio'
import { buildCloze, type ClozeToken } from '../services/frequency'
import { gradeReviewState, type Grade } from '../services/srs'
import { countDueReviewItems, getAdjacentSegments, getDueReviewItems, upsertReviewState } from '../db/repository'
import { pushLocalChanges } from '../services/sync'
import type { DueReviewItem, LocalSegment } from '../types/models'

interface RevueState {
  queue: DueReviewItem[]
  index: number
  player: EpisodePlayer | null
  loadedEpisodeId: number | null
  revealed: boolean
  isPlaying: boolean
  prev: LocalSegment | null
  next: LocalSegment | null
  loading: boolean
  done: boolean
  dueCount: number
}

export const useRevueStore = defineStore('revue', {
  state: (): RevueState => ({
    queue: [],
    index: 0,
    player: null,
    loadedEpisodeId: null,
    revealed: false,
    isPlaying: false,
    prev: null,
    next: null,
    loading: false,
    done: false,
    dueCount: 0,
  }),

  getters: {
    current(state): DueReviewItem | null {
      return state.queue[state.index] ?? null
    },
    remaining(state): number {
      return Math.max(0, state.queue.length - state.index)
    },
  },

  actions: {
    async refreshDueCount(): Promise<void> {
      this.dueCount = await countDueReviewItems(Date.now())
    },

    async start(): Promise<void> {
      this.loading = true
      this.done = false
      this.index = 0
      this.queue = await getDueReviewItems(Date.now())
      this.loading = false
      if (this.queue.length === 0) {
        this.done = true
        return
      }
      await this.loadCurrent()
    },

    async loadCurrent(): Promise<void> {
      const item = this.current
      if (!item) {
        this.done = true
        return
      }
      this.revealed = false

      if (this.loadedEpisodeId !== item.episodeId) {
        this.player?.destroy()
        this.player = await EpisodePlayer.create(item.audioRelativePath, item.episodeTitle)
        this.loadedEpisodeId = item.episodeId
      }

      const ctx = await getAdjacentSegments(item.episodeId, item.segment.idx)
      this.prev = ctx.prev
      this.next = ctx.next

      this.playCurrentSegment()
    },

    playCurrentSegment(): void {
      const item = this.current
      if (!item || !this.player) return
      this.isPlaying = true
      this.player.playSegment(item.segment.startMs, item.segment.endMs)
      // playSegment s'arrête tout seul à endMs ; on reflète l'état après un
      // court délai suffisant pour la majorité des segments (3-15s, §8).
      const durationMs = item.segment.endMs - item.segment.startMs
      setTimeout(() => {
        this.isPlaying = false
      }, durationMs + 200)
    },

    reveal(): void {
      this.revealed = true
    },

    cloze(item: DueReviewItem): ClozeToken[] {
      return buildCloze(item.segment.text, item.lang, item.level)
    },

    async grade(grade: Grade): Promise<void> {
      const item = this.current
      if (!item) return

      const updated = gradeReviewState(item.reviewState, grade)
      await upsertReviewState(updated)
      void pushLocalChanges() // best-effort
      await this.refreshDueCount()

      this.index++
      if (this.index >= this.queue.length) {
        this.done = true
        this.player?.destroy()
        this.player = null
        this.loadedEpisodeId = null
      } else {
        await this.loadCurrent()
      }
    },
  },
})
