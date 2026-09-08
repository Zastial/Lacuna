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
import { ensureSentences, key as sentenceKey, loadLocalSentences, type SentenceMap } from '../services/sentences'
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
  sentences: SentenceMap
  session: Session | null
  loading: boolean
  preparing: boolean
}

export const useFondationsStore = defineStore('fondations', {
  state: (): FondationsState => ({
    lang: 'it',
    lessons: [],
    states: new Map(),
    dueCount: 0,
    sentences: new Map(),
    session: null,
    loading: false,
    preparing: false,
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
      this.sentences = await loadLocalSentences(this.lang)
    },

    // withSentence remplace l'énoncé nu par la phrase contextualisée quand on
    // en a une. L'id reste celui de l'item : la phrase n'est qu'un habillage,
    // pas une autre connaissance à suivre séparément.
    dressed(item: ConjugItem): ConjugItem {
      const verbTense = item.id.startsWith('gen:') ? item.id.split(':') : null
      if (!verbTense) return item
      const [, , lemma, tense, person] = verbTense
      const s = this.sentences.get(sentenceKey(lemma, tense, person))
      return s ? { ...item, prompt: s.prompt, promptFr: s.promptFr } : item
    },

    // startLesson n'ouvre que la leçon courante : laisser sauter en avant
    // reproduirait le défaut d'origine, une liste d'exercices sans ordre ni
    // raison d'être.
    async startLesson(): Promise<void> {
      const lesson = this.currentLesson
      if (!lesson) return

      // Les phrases manquantes sont demandées avant de commencer : arriver
      // sur un « io ___ » nu puis le voir changer en cours d'exercice serait
      // déroutant.
      this.preparing = true
      const fetched = await ensureSentences(
        this.lang,
        lesson.verb.lemma,
        lesson.tense,
        lesson.forms.map((f) => ({ person: f.person, form: f.form })),
        this.sentences,
      )
      if (fetched) this.sentences = await loadLocalSentences(this.lang)
      this.preparing = false

      const items = lesson.forms
        .map((f) => buildDrill(this.lang, lesson.verb, lesson.tense, f.person as never))
        .filter((i): i is ConjugItem => i !== null)
        .map((i) => this.dressed(i))

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
        .map((i) => this.dressed(i))
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
