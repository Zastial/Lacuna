// Intégration FSRS (§8 Phase 3) : open-spaced-repetition/ts-fsrs est
// disponible et maintenu, pas besoin de réimplémenter l'algorithme.
// Notation binaire "j'ai su / j'ai pas su" (§3.3 — modèle Anki, validé
// pédagogiquement dans le plan), mappée sur deux des quatre grades FSRS.
import { type Card, createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'
import type { ReviewState, VocabReviewState } from '../types/models'

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))

export type Grade = 'again' | 'good'

// Champs FSRS partagés par ReviewState (segments audio) et VocabReviewState
// (items FONDATIONS) — factorisé ici pour ne pas dupliquer l'appel au
// scheduler entre les deux, sans pour autant unifier les deux types (l'un a
// un segmentId numérique, l'autre un itemId + lang, pas la même clé).
interface FsrsFields {
  dueAt: number
  stability: number
  difficulty: number
  reps: number
  lapses: number
  lastGrade: number | null
  lastReview: number | null
}

function newFsrsFields(): FsrsFields {
  const card = createEmptyCard(new Date())
  return {
    dueAt: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    lastGrade: null,
    lastReview: null,
  }
}

function gradeFsrsFields(fields: FsrsFields, grade: Grade): FsrsFields {
  const card = toCard(fields)
  const rating = grade === 'good' ? Rating.Good : Rating.Again
  const { card: updated } = scheduler.next(card, new Date(), rating)

  return {
    dueAt: updated.due.getTime(),
    stability: updated.stability,
    difficulty: updated.difficulty,
    reps: updated.reps,
    lapses: updated.lapses,
    lastGrade: rating,
    lastReview: Date.now(),
  }
}

function toCard(fields: FsrsFields): Card {
  return {
    due: new Date(fields.dueAt),
    stability: fields.stability,
    difficulty: fields.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: fields.reps,
    lapses: fields.lapses,
    state: fields.reps === 0 ? State.New : State.Review,
    last_review: fields.lastReview ? new Date(fields.lastReview) : undefined,
  }
}

// newReviewState initialise l'état d'un segment fraîchement capturé : dû
// immédiatement, pour apparaître dans la file de révision du soir même.
export function newReviewState(segmentId: number): ReviewState {
  return { segmentId, ...newFsrsFields(), synced: false }
}

export function gradeReviewState(state: ReviewState, grade: Grade): ReviewState {
  return { segmentId: state.segmentId, ...gradeFsrsFields(state, grade), synced: false }
}

// Même logique pour le vocabulaire/conjugaison du mode FONDATIONS, dû
// immédiatement dès l'introduction d'un item (apparaît dans le prochain
// entraînement mêlé plutôt que d'attendre un intervalle initial).
export function newVocabReviewState(itemId: string, lang: string): VocabReviewState {
  return { itemId, lang, ...newFsrsFields(), synced: false }
}

export function gradeVocabReviewState(state: VocabReviewState, grade: Grade): VocabReviewState {
  return { itemId: state.itemId, lang: state.lang, ...gradeFsrsFields(state, grade), synced: false }
}
