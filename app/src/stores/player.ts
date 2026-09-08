import { defineStore } from 'pinia'

import { EpisodePlayer } from '../services/audio'
import { findSegmentAt, getReviewState, insertCapture, upsertReviewState } from '../db/repository'
import { newReviewState } from '../services/srs'
import { pushLocalChanges } from '../services/sync'
import { useRevueStore } from './revue'
import type { CaptureKind, LocalEpisode } from '../types/models'

// §7 TRANSPORT : checkpoint toutes les 90s (configurable mais jamais
// désactivable), replay de 15s en option pour reprendre.
export const CHECKPOINT_INTERVAL_MS = 90_000
const REPLAY_SECONDS = 15

interface PlayerState {
  episode: LocalEpisode | null
  player: EpisodePlayer | null
  isPlaying: boolean
  currentTimeMs: number
  durationMs: number
  checkpointPending: boolean
  lastCheckpointAtMs: number
  captureCount: number
  lastCaptureAt: number | null
}

export const usePlayerStore = defineStore('player', {
  state: (): PlayerState => ({
    episode: null,
    player: null,
    isPlaying: false,
    currentTimeMs: 0,
    durationMs: 0,
    checkpointPending: false,
    lastCheckpointAtMs: 0,
    captureCount: 0,
    lastCaptureAt: null,
  }),

  actions: {
    async load(episode: LocalEpisode): Promise<void> {
      this.player?.destroy()

      this.episode = episode
      this.player = await EpisodePlayer.create(episode.audioRelativePath, episode.title)
      this.currentTimeMs = 0
      this.durationMs = episode.durationS ? episode.durationS * 1000 : 0
      this.lastCheckpointAtMs = 0
      this.checkpointPending = false
      this.captureCount = 0
      this.isPlaying = false

      this.player.onTimeUpdate((ms) => this.handleTimeUpdate(ms))
      this.player.onEnded(() => {
        this.isPlaying = false
      })
    },

    handleTimeUpdate(ms: number): void {
      this.currentTimeMs = ms
      if (this.player) this.durationMs = this.player.durationMs || this.durationMs

      if (!this.checkpointPending && ms - this.lastCheckpointAtMs >= CHECKPOINT_INTERVAL_MS) {
        // Ne jamais muter le DOM (montage de l'overlay) ni appeler pause()
        // en étant encore dans la pile d'appel du handler 'timeupdate' de
        // l'élément <audio> lui-même : WKWedbView peut geler la réception
        // des touches sur toute la page si on le fait de façon synchrone
        // depuis cet event. On sort du tick courant avant d'agir.
        setTimeout(() => this.triggerCheckpoint(), 0)
      }
    },

    // Coupe la lecture et exige une action explicite pour reprendre — le
    // garde-fou contre l'écoute passive prolongée (§1, thèse produit).
    triggerCheckpoint(): void {
      if (this.checkpointPending) return
      this.checkpointPending = true
      this.player?.pause()
      this.isPlaying = false
    },

    resumeAfterCheckpoint(mode: 'continue' | 'replay'): void {
      if (!this.player) return
      if (mode === 'replay') {
        this.player.currentTimeMs = Math.max(0, this.currentTimeMs - REPLAY_SECONDS * 1000)
      }
      this.lastCheckpointAtMs = this.currentTimeMs
      this.checkpointPending = false
      this.play()
    },

    play(): void {
      this.player?.play()
      this.isPlaying = true
    },

    pause(): void {
      this.player?.pause()
      this.isPlaying = false
    },

    // Capture : timestamp -> segment, écriture SQLite, aucune interruption
    // de la lecture ni feedback bloquant (§7).
    async capture(kind: CaptureKind = 'not_understood'): Promise<void> {
      if (!this.episode) return
      const segment = await findSegmentAt(this.episode.id, this.currentTimeMs)
      if (!segment) return

      await insertCapture({
        id: crypto.randomUUID(),
        segmentId: segment.id,
        episodeId: this.episode.id,
        capturedAt: Date.now(),
        kind,
        note: null,
        synced: false,
      })
      this.captureCount++
      this.lastCaptureAt = Date.now()

      // Un segment capturé pour la première fois entre en révision, dû dès
      // ce soir (§7). Une recapture d'un segment déjà en révision ne
      // réinitialise pas sa progression FSRS.
      const existing = await getReviewState(segment.id)
      if (!existing) {
        await upsertReviewState(newReviewState(segment.id))
        void useRevueStore().refreshDueCount()
      }

      void pushLocalChanges() // best-effort, ne bloque jamais la capture
    },
  },
})
