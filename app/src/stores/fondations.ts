import { defineStore } from 'pinia'

import { findConjugItem } from '../data/fondations'
import {
  getAllVocabReviewStatesForLang,
  getDueVocabItems,
  getVocabReviewState,
  upsertVocabReviewState,
} from '../db/repository'
import { buildDrill, resolveGeneratedItem } from '../services/drillGenerator'
import { lessonsForLang, lessonStates, type Lesson, type LessonState } from '../services/curriculum'
import { shuffle } from '../services/shuffle'
import { gradeVocabReviewState, isAcquired, newVocabReviewState, type Grade } from '../services/srs'
import type { ConjugItem } from '../types/models'

// Une session se déroule en trois temps, et c'est tout l'objet de cette
// refonte : on ne pratique pas ce qu'on n'a pas vu.
//
//   découvrir  — les six formes sont montrées, sans rien demander
//   pratiquer  — exercices portant exactement sur ces six formes
//   bilan      — ce qui est acquis, ce qui revient en révision
export type Phase = 'discover' | 'practice' | 'summary'

interface Session {
  kind: 'lesson' | 'review'
  lesson: Lesson | null
  phase: Phase
  items: ConjugItem[]
  step: number
  wrong: string[]
}

interface FondationsState {
  lang: string
  lessons: Lesson[]
  states: Map<string, LessonState>
  dueCount: number
  session: Session | null
  loading: boolean
}

export const useFondationsStore = defineStore('fondations', {
  state: (): FondationsState => ({
    lang: 'it',
    lessons: [],
    states: new Map(),
    dueCount: 0,
    session: null,
    loading: false,
  }),

  getters: {
    currentLesson(state): Lesson | null {
      return state.lessons.find((l) => state.states.get(l.id) === 'current') ?? null
    },
    doneCount(state): number {
      let n = 0
      for (const s of state.states.values()) if (s === 'done') n++
      return n
    },
    currentItem(state): ConjugItem | null {
      if (!state.session) return null
      return state.session.items[state.session.step] ?? null
    },
  },

  actions: {
    async init(): Promise<void> {
      this.loading = true
      await this.refresh()
      this.loading = false
    },

    async setLang(lang: string): Promise<void> {
      this.lang = lang
      this.session = null
      await this.refresh()
    },

    async refresh(): Promise<void> {
      this.lessons = lessonsForLang(this.lang)
      const states = await getAllVocabReviewStatesForLang(this.lang)
      const acquired = new Set(states.filter(isAcquired).map((s) => s.itemId))
      this.states = lessonStates(this.lessons, acquired)
      this.dueCount = (await getDueVocabItems(this.lang, Date.now(), 999)).length
    },

    // startLesson n'ouvre que la leçon courante : laisser sauter en avant
    // reproduirait le défaut d'origine, une liste d'exercices sans ordre ni
    // raison d'être.
    startLesson(): void {
      const lesson = this.currentLesson
      if (!lesson) return

      const items = lesson.forms
        .map((f) => buildDrill(this.lang, lesson.verb, lesson.tense, f.person as never))
        .filter((i): i is ConjugItem => i !== null)

      this.session = {
        kind: 'lesson',
        lesson,
        phase: 'discover',
        items: shuffle(items).map((i) => ({ ...i, options: shuffle(i.options) })),
        step: 0,
        wrong: [],
      }
    },

    // startReview sert ce que la répétition espacée réclame aujourd'hui,
    // toutes leçons confondues. Pas de phase « découvrir » : ces formes ont
    // déjà été présentées, les revoir d'abord viderait l'exercice de son
    // intérêt.
    async startReview(): Promise<void> {
      const due = await getDueVocabItems(this.lang, Date.now(), 15)
      const items = due
        .map((d) => findConjugItem(this.lang, d.itemId) ?? resolveGeneratedItem(d.itemId))
        .filter((i): i is ConjugItem => i !== null)
      if (items.length === 0) return

      this.session = {
        kind: 'review',
        lesson: null,
        phase: 'practice',
        items: items.map((i) => ({ ...i, options: shuffle(i.options) })),
        step: 0,
        wrong: [],
      }
    },

    beginPractice(): void {
      if (this.session) this.session.phase = 'practice'
    },

    async answer(item: ConjugItem, correct: boolean): Promise<void> {
      if (!this.session) return
      if (!correct && !this.session.wrong.includes(item.id)) {
        this.session.wrong.push(item.id)
      }

      const grade: Grade = correct ? 'good' : 'again'
      const existing = await getVocabReviewState(item.id)
      const base = existing ?? newVocabReviewState(item.id, this.lang)
      await upsertVocabReviewState(gradeVocabReviewState(base, grade))
    },

    next(): void {
      if (!this.session) return
      if (this.session.step >= this.session.items.length - 1) {
        this.session.phase = 'summary'
        return
      }
      this.session.step++
    },

    // Rejouer seulement ce qui a été manqué : c'est là que la répétition a le
    // plus de valeur, et refaire l'ensemble découragerait pour six formes
    // dont cinq étaient sues.
    retryWrong(): void {
      if (!this.session) return
      const wrong = this.session.items.filter((i) => this.session!.wrong.includes(i.id))
      if (wrong.length === 0) return
      this.session.items = wrong.map((i) => ({ ...i, options: shuffle(i.options) }))
      this.session.step = 0
      this.session.wrong = []
      this.session.phase = 'practice'
    },

    async endSession(): Promise<void> {
      this.session = null
      await this.refresh()
    },
  },
})
