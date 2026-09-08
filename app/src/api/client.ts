import type { ApiArticle, ApiVideo } from '../types/models'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    throw new Error(`GET ${path}: HTTP ${res.status}`)
  }
  return (await res.json()) as T
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
