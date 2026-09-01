import type { ApiEpisode, ApiEpisodeSegments, ApiFeed } from '../types/models'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    throw new Error(`GET ${path}: HTTP ${res.status}`)
  }
  return (await res.json()) as T
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
