import type { ApiArticle, ApiEpisode, ApiEpisodeSegments, ApiFeed, ApiVideo, Capture, ReviewState } from '../types/models'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    throw new Error(`GET ${path}: HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

async function postJSON(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`POST ${path}: HTTP ${res.status}`)
  }
}

export function listFeeds(): Promise<ApiFeed[]> {
  return getJSON<ApiFeed[]>('/feeds')
}

export function listEpisodes(params: { lang?: string; level?: string } = {}): Promise<ApiEpisode[]> {
  const qs = new URLSearchParams()
  if (params.lang) qs.set('lang', params.lang)
  if (params.level) qs.set('level', params.level)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return getJSON<ApiEpisode[]>(`/episodes${suffix}`)
}

export function getEpisodeSegments(episodeId: number): Promise<ApiEpisodeSegments> {
  return getJSON<ApiEpisodeSegments>(`/episodes/${episodeId}/segments`)
}

export function listVideos(
  params: { lang?: string; limit?: number; categories?: string[] } = {},
): Promise<ApiVideo[]> {
  const qs = new URLSearchParams()
  if (params.lang) qs.set('lang', params.lang)
  if (params.limit) qs.set('limit', String(params.limit))
  // Liste vide = pas de filtre côté API. L'envoyer quand même reviendrait à
  // demander « aucune catégorie », donc aucune vidéo.
  if (params.categories && params.categories.length > 0) {
    qs.set('categories', params.categories.join(','))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return getJSON<ApiVideo[]>(`/videos${suffix}`)
}

export function listArticles(
  params: { lang?: string; limit?: number; sports?: string[] } = {},
): Promise<ApiArticle[]> {
  const qs = new URLSearchParams()
  if (params.lang) qs.set('lang', params.lang)
  if (params.limit) qs.set('limit', String(params.limit))
  // Liste vide = pas de filtre côté API : n'envoyer le paramètre que s'il
  // restreint réellement, sinon on demanderait « aucun sport ».
  if (params.sports && params.sports.length > 0) qs.set('sports', params.sports.join(','))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return getJSON<ApiArticle[]>(`/articles${suffix}`)
}

// --- sync (§6.4) : push périodique capture/review_state, pull pour
// restaurer après réinstallation (le conteneur sandbox iOS est perdu à
// chaque redéploiement Xcode, §3.1). ---

export interface SyncStateResponse {
  captures: Array<{
    id: string
    segment_id: number
    episode_id: number
    captured_at: number
    kind: string
    note: string | null
  }>
  review_state: Array<{
    segment_id: number
    due_at: number
    stability: number
    difficulty: number
    reps: number
    lapses: number
    last_grade: number | null
    last_review: number | null
  }>
}

export function pushCaptures(captures: Capture[]): Promise<void> {
  return postJSON(
    '/sync/captures',
    captures.map((c) => ({
      id: c.id,
      segment_id: c.segmentId,
      episode_id: c.episodeId,
      captured_at: c.capturedAt,
      kind: c.kind,
      note: c.note,
    })),
  )
}

export function pushReviewStates(states: ReviewState[]): Promise<void> {
  return postJSON(
    '/sync/review_state',
    states.map((s) => ({
      segment_id: s.segmentId,
      due_at: s.dueAt,
      stability: s.stability,
      difficulty: s.difficulty,
      reps: s.reps,
      lapses: s.lapses,
      last_grade: s.lastGrade,
      last_review: s.lastReview,
    })),
  )
}

export function pullSyncState(): Promise<SyncStateResponse> {
  return getJSON<SyncStateResponse>('/sync/state')
}
