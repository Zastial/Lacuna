import { defineStore } from 'pinia'

import { cultureForLang } from '../data/cultureg'
import {
  countDueCultureItems,
  getCultureReviewState,
  getCultureStats,
  recordCultureAnswer,
  upsertCultureReviewState,
} from '../db/repository'
import { shuffle } from '../services/shuffle'
import { gradeVocabReviewState, newVocabReviewState, type Grade } from '../services/srs'
import type { CultureQuestion, CultureStats } from '../types/models'

const SESSION_SIZE = 10

interface CultureGState {
  lang: string
  dueCount: number
  stats: CultureStats
  queue: CultureQuestion[]
  index: number
  answered: boolean
  lastCorrect: boolean
  loading: boolean
  done: boolean
}

export const useCultureGStore = defineStore('cultureg', {
  state: (): CultureGState => ({
    lang: 'it',
    dueCount: 0,
    stats: { lang: 'it', correct: 0, total: 0 },
    queue: [],
    index: 0,
    answered: false,
    lastCorrect: false,
    loading: false,
    done: false,
  }),

  getters: {
    current(state): CultureQuestion | null {
      return state.queue[state.index] ?? null
    },
    remaining(state): number {
      return Math.max(0, state.queue.length - state.index)
    },
  },

  actions: {
    async init(): Promise<void> {
      this.stats = await getCultureStats(this.lang)
      await this.refreshDueCount()
    },

    async setLang(lang: string): Promise<void> {
      this.lang = lang
      this.stats = await getCultureStats(lang)
      await this.refreshDueCount()
    },

    // Une question compte comme "prête" si elle n'a jamais été vue ou si sa
    // révision FSRS est due — contrairement à FONDATIONS, il n'y a pas
    // d'étape d'introduction séparée : la première rencontre EST le quiz.
    async refreshDueCount(): Promise<void> {
      const seenDue = await countDueCultureItems(this.lang, Date.now())
      let unseen = 0
      for (const q of cultureForLang(this.lang)) {
        const state = await getCultureReviewState(q.id)
        if (!state) unseen++
      }
      this.dueCount = seenDue + unseen
    },

    async start(): Promise<void> {
      this.loading = true
      this.index = 0
      this.done = false
      const now = Date.now()
      const picked: CultureQuestion[] = []
      for (const q of cultureForLang(this.lang)) {
        const state = await getCultureReviewState(q.id)
        // Options mélangées une fois par session : dans data/cultureg la
        // bonne réponse est toujours écrite en premier.
        if (!state || state.dueAt <= now) picked.push({ ...q, options: shuffle(q.options) })
        if (picked.length >= SESSION_SIZE) break
      }
      this.queue = picked
      this.loading = false
      this.answered = false
      if (this.queue.length === 0) this.done = true
    },

    async answer(choiceIndex: number): Promise<void> {
      const question = this.current
      if (!question || this.answered) return
      this.answered = true
      const correct = question.options[choiceIndex]?.correct ?? false
      this.lastCorrect = correct

      const grade: Grade = correct ? 'good' : 'again'
      const existing = await getCultureReviewState(question.id)
      const updated = existing
        ? gradeVocabReviewState(existing, grade)
        : gradeVocabReviewState(newVocabReviewState(question.id, this.lang), grade)
      await upsertCultureReviewState(updated)
      await recordCultureAnswer(this.lang, correct)
      this.stats = await getCultureStats(this.lang)
    },

    async next(): Promise<void> {
      this.answered = false
      if (this.index >= this.queue.length - 1) {
        this.done = true
        await this.refreshDueCount()
        return
      }
      this.index++
    },

    exit(): void {
      this.queue = []
      this.index = 0
      this.done = false
      this.answered = false
    },
  },
})
