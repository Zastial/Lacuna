// Sync client -> serveur (§6.4) : pull only côté contenu (déjà couvert par
// le téléchargement d'épisode), push périodique côté capture/review_state.
// Le serveur ne modifie jamais ces lignes : c'est une sauvegarde, pas un
// moteur de synchronisation bidirectionnelle avec résolution de conflits —
// utilisateur unique, un seul appareil actif à la fois.
import { pullSyncState, pushCaptures, pushReviewStates } from '../api/client'
import {
  getUnsyncedCaptures,
  getUnsyncedReviewStates,
  insertCapture,
  markCapturesSynced,
  markReviewStatesSynced,
  upsertReviewStateIfMissing,
} from '../db/repository'
import type { Capture, ReviewState } from '../types/models'

export async function pushLocalChanges(): Promise<void> {
  const captures = await getUnsyncedCaptures()
  if (captures.length > 0) {
    await pushCaptures(captures)
    await markCapturesSynced(captures.map((c) => c.id))
  }

  const states = await getUnsyncedReviewStates()
  if (states.length > 0) {
    await pushReviewStates(states)
    await markReviewStatesSynced(states.map((s) => s.segmentId))
  }
}

// pullRemoteBackup restaure ce qui manque localement — le cas concret visé
// est la réinstallation hebdomadaire via Xcode (§3.1), qui vide le
// conteneur sandbox. N'écrase jamais un état local déjà présent.
export async function pullRemoteBackup(): Promise<void> {
  const remote = await pullSyncState()

  for (const c of remote.captures) {
    const capture: Capture = {
      id: c.id,
      segmentId: c.segment_id,
      episodeId: c.episode_id,
      capturedAt: c.captured_at,
      kind: c.kind as Capture['kind'],
      note: c.note,
      synced: true,
    }
    await insertCapture(capture)
  }

  for (const s of remote.review_state) {
    const state: ReviewState = {
      segmentId: s.segment_id,
      dueAt: s.due_at,
      stability: s.stability,
      difficulty: s.difficulty,
      reps: s.reps,
      lapses: s.lapses,
      lastGrade: s.last_grade,
      lastReview: s.last_review,
      synced: true,
    }
    await upsertReviewStateIfMissing(state)
  }
}

// syncNow ne doit jamais faire échouer l'appelant : hors ligne (métro,
// avion), c'est le cas normal d'usage du mode TRANSPORT (§3.2).
export async function syncNow(): Promise<void> {
  try {
    await pushLocalChanges()
    await pullRemoteBackup()
  } catch (err) {
    console.warn('sync: échec (hors ligne ?)', err)
  }
}
