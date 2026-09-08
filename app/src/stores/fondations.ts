import { defineStore } from 'pinia'

import { allConjugItemsForLang, findConjugItem, scenariosForLang } from '../data/fondations'
import {
  getAllVocabReviewStatesForLang,
  getCompletedScenarioIds,
  getDueVocabItems,
  getVocabReviewState,
  markScenarioCompleted,
  upsertVocabReviewState,
} from '../db/repository'
import { generateDrills, resolveGeneratedItem, verbOfItemId, verbsForLang } from '../services/drillGenerator'
import { shuffle } from '../services/shuffle'
import { gradeVocabReviewState, newVocabReviewState, type Grade } from '../services/srs'
import { pushLocalChanges } from '../services/sync'
import type { ConjugItem, Scenario, ScenarioMCQ } from '../types/models'

// Taille d'une série d'entraînement rapide.
const DRILL_SIZE = 10

export type MasteryTier = 'new' | 'bronze' | 'silver' | 'gold'

// Palier de maîtrise d'un verbe : le minimum de répétitions réussies sur
// toutes ses formes (io/tu/...) — un verbe n'est "or" que si TOUTES ses
// formes suivies sont solides, pas seulement une.
function tierFromReps(minReps: number): MasteryTier {
  if (minReps >= 6) return 'gold'
  if (minReps >= 3) return 'silver'
  if (minReps >= 1) return 'bronze'
  return 'new'
}

type FondationsStep =
  | { kind: 'dialogue'; scenario: Scenario }
  | { kind: 'mcq'; mcq: ScenarioMCQ }
  | { kind: 'conjug'; item: ConjugItem }
  | { kind: 'done'; scenario: Scenario }
  | { kind: 'drillDone'; count: number }

interface Session {
  kind: 'scenario' | 'drill'
  scenario: Scenario | null
  steps: FondationsStep[]
  stepIndex: number
}

interface FondationsState {
  lang: string
  completedIds: Set<string>
  session: Session | null
  subtitleLang: 'fr' | 'target'
  loading: boolean
  dueDrillCount: number
  verbMastery: Record<string, MasteryTier>
}

export const useFondationsStore = defineStore('fondations', {
  state: (): FondationsState => ({
    lang: 'it',
    completedIds: new Set(),
    session: null,
    subtitleLang: 'fr',
    loading: false,
    dueDrillCount: 0,
    verbMastery: {},
  }),

  getters: {
    scenarios(state): Scenario[] {
      return scenariosForLang(state.lang)
    },
    currentStep(state): FondationsStep | null {
      if (!state.session) return null
      return state.session.steps[state.session.stepIndex] ?? null
    },
  },

  actions: {
    async init(): Promise<void> {
      this.loading = true
      this.completedIds = await getCompletedScenarioIds()
      await this.refreshDueDrillCount()
      await this.refreshVerbMastery()
      this.loading = false
    },

    async setLang(lang: string): Promise<void> {
      this.lang = lang
      await this.refreshDueDrillCount()
      await this.refreshVerbMastery()
    },

    async refreshDueDrillCount(): Promise<void> {
      const due = await getDueVocabItems(this.lang, Date.now(), 999)
      this.dueDrillCount = due.length
    },

    // La maîtrise couvre à la fois les items écrits à la main (scénarios) et
    // les items générés : un verbe n'est "or" que si TOUTES ses formes
    // rencontrées sont solides, quelle que soit leur provenance.
    async refreshVerbMastery(): Promise<void> {
      const states = await getAllVocabReviewStatesForLang(this.lang)
      const repsById = new Map(states.map((s) => [s.itemId, s.reps]))
      const repsByVerb = new Map<string, number[]>()

      const push = (verb: string, reps: number): void => {
        const list = repsByVerb.get(verb) ?? []
        list.push(reps)
        repsByVerb.set(verb, list)
      }

      for (const item of allConjugItemsForLang(this.lang)) {
        push(item.verb, repsById.get(item.id) ?? 0)
      }
      // Les verbes de l'inventaire jamais rencontrés restent à 0 : ils
      // apparaissent donc comme "nouveaux" et sont priorisés au tirage.
      for (const verb of verbsForLang(this.lang)) {
        if (!repsByVerb.has(verb.lemma)) push(verb.lemma, 0)
      }
      for (const state of states) {
        const verb = verbOfItemId(state.itemId)
        if (verb) push(verb, state.reps)
      }

      const mastery: Record<string, MasteryTier> = {}
      for (const [verb, repsList] of repsByVerb) {
        mastery[verb] = tierFromReps(Math.min(...repsList))
      }
      this.verbMastery = mastery
    },

    startScenario(scenarioId: string): void {
      const scenario = this.scenarios.find((s) => s.id === scenarioId)
      if (!scenario) return

      // Les options sont mélangées à la construction de la session (une fois
      // par question, pas à chaque rendu) : dans les fichiers de contenu la
      // bonne réponse est toujours écrite en premier, sans mélange elle
      // serait devinable sans rien connaître.
      const steps: FondationsStep[] = [
        { kind: 'dialogue', scenario },
        ...scenario.mcqs.map((mcq): FondationsStep => ({ kind: 'mcq', mcq: { ...mcq, options: shuffle(mcq.options) } })),
        ...scenario.conjugation.map((item): FondationsStep => ({ kind: 'conjug', item: { ...item, options: shuffle(item.options) } })),
        { kind: 'done', scenario },
      ]

      this.session = { kind: 'scenario', scenario, steps, stepIndex: 0 }
    },

    // startQuickDrill : entraînement "sans son", jamais vide. On sert d'abord
    // ce qui est dû (la répétition espacée prime), puis on complète avec des
    // items générés — verbes les moins maîtrisés en priorité, ce qui rend la
    // série propre à chaque utilisateur.
    async startQuickDrill(): Promise<void> {
      const due = await getDueVocabItems(this.lang, Date.now(), DRILL_SIZE)
      const dueItems = due
        .map((d) => findConjugItem(this.lang, d.itemId) ?? resolveGeneratedItem(d.itemId))
        .filter((item): item is ConjugItem => item !== null)

      const seen = new Set(dueItems.map((i) => i.id))
      const fresh = generateDrills(this.lang, DRILL_SIZE * 2, this.verbMastery)
        .filter((item) => !seen.has(item.id))
        .slice(0, Math.max(0, DRILL_SIZE - dueItems.length))

      const items = [...dueItems, ...fresh]
      if (items.length === 0) return

      const steps: FondationsStep[] = [
        ...items.map((item): FondationsStep => ({ kind: 'conjug', item: { ...item, options: shuffle(item.options) } })),
        { kind: 'drillDone', count: items.length },
      ]
      this.session = { kind: 'drill', scenario: null, steps, stepIndex: 0 }
    },

    toggleSubtitleLang(): void {
      this.subtitleLang = this.subtitleLang === 'fr' ? 'target' : 'fr'
    },

    // gradeConjugItem persiste le résultat d'un item de conjugaison en FSRS —
    // qu'il soit introduit pour la première fois ou déjà en révision (repris
    // d'un scénario précédent, cf. les ids réutilisés dans data/fondations).
    async gradeConjugItem(item: ConjugItem, correct: boolean): Promise<void> {
      const grade: Grade = correct ? 'good' : 'again'
      const existing = await getVocabReviewState(item.id)
      const updated = existing ? gradeVocabReviewState(existing, grade) : gradeVocabReviewState(newVocabReviewState(item.id, this.lang), grade)
      await upsertVocabReviewState(updated)
      void pushLocalChanges()
      await this.refreshVerbMastery()
    },

    async next(): Promise<void> {
      if (!this.session) return
      if (this.session.stepIndex >= this.session.steps.length - 1) {
        if (this.session.kind === 'scenario' && this.session.scenario) {
          await markScenarioCompleted(this.session.scenario.id)
          this.completedIds.add(this.session.scenario.id)
        }
        return
      }
      this.session.stepIndex++
    },

    back(): void {
      if (!this.session) return
      if (this.session.stepIndex > 0) this.session.stepIndex--
    },

    async exitSession(): Promise<void> {
      this.session = null
      await this.refreshDueDrillCount()
    },
  },
})
