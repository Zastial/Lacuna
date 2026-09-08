// Calcul de difficulté et cloze déterministes (§6.3, §7 mode REVUE), miroir
// côté client de internal/frequency en Go. Aucun traitement statistique
// au-delà d'un classement par rang — pas d'IA (§3.3).
import enList from '../data/frequency/en.txt?raw'
import esList from '../data/frequency/es.txt?raw'
import itList from '../data/frequency/it.txt?raw'

const RAW_LISTS: Record<string, string> = { en: enList, es: esList, it: itList }

// Seuils par niveau (§6.3) : N mots les plus fréquents retenus.
export const THRESHOLDS: Record<string, number> = {
  beginner: 1000,
  intermediate: 3000,
  native: 5000,
}

const wordRe = /\p{L}+/gu

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(wordRe) ?? []
}

const rankSetCache = new Map<string, Set<string>>()

// loadRankSet renvoie l'ensemble des mots de rang <= threshold pour une
// langue, mis en cache (la liste ne change jamais en cours de session).
export function loadRankSet(lang: string, threshold: number): Set<string> {
  const cacheKey = `${lang}:${threshold}`
  const cached = rankSetCache.get(cacheKey)
  if (cached) return cached

  const raw = RAW_LISTS[lang]
  const set = new Set<string>()
  if (raw) {
    const lines = raw.split('\n')
    for (let i = 0; i < lines.length && i < threshold; i++) {
      const word = lines[i].split(/\s+/)[0]
      if (word) set.add(word)
    }
  }
  rankSetCache.set(cacheKey, set)
  return set
}

export interface ClozeToken {
  text: string
  masked: boolean
}

// buildCloze découpe le texte en tokens et marque comme "à masquer" les mots
// absents du top-N de la langue (§6.3) — ce sont les mots rares qui valent
// la peine d'être testés, pas le vocabulaire déjà connu.
export function buildCloze(text: string, lang: string, level: string): ClozeToken[] {
  const threshold = THRESHOLDS[level] ?? THRESHOLDS.intermediate
  const rankSet = loadRankSet(lang, threshold)

  // Segmente en conservant la ponctuation/espaces entre les mots, pour
  // reconstruire un texte lisible une fois les blancs affichés.
  const parts = text.split(/(\p{L}+)/gu)
  return parts
    .filter((p) => p !== '')
    .map((p) => {
      const isWord = /^\p{L}+$/u.test(p)
      const masked = isWord && !rankSet.has(p.toLowerCase())
      return { text: p, masked }
    })
}
