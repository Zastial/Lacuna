import type { CultureQuestion } from '../../types/models'
import { IT_CULTURE } from './it'
import { ES_CULTURE } from './es'

export const CULTURE_BY_LANG: Record<string, CultureQuestion[]> = {
  it: IT_CULTURE,
  es: ES_CULTURE,
}

export function cultureForLang(lang: string): CultureQuestion[] {
  return CULTURE_BY_LANG[lang] ?? []
}

export function findCultureQuestion(lang: string, id: string): CultureQuestion | null {
  return cultureForLang(lang).find((q) => q.id === id) ?? null
}
