import { fetchSentences } from '../api/client'
import { getSentencesForLang, saveSentences, type StoredSentence } from '../db/repository'

// Phrases d'exercice : « io ___ italiano » plutôt que « io ___ ».
//
// Elles sont générées côté serveur, une fois par verbe et par temps, puis
// recopiées en base locale. L'app fonctionne donc hors ligne dès la première
// visite d'une leçon, et une leçon déjà vue ne coûte plus rien.
export type SentenceMap = Map<string, { prompt: string; promptFr: string }>

export function key(lemma: string, tense: string, person: string): string {
  return `${lemma}:${tense}:${person}`
}

export async function loadLocalSentences(lang: string): Promise<SentenceMap> {
  const rows = await getSentencesForLang(lang)
  return new Map(rows.map((r) => [key(r.lemma, r.tense, r.person), { prompt: r.prompt, promptFr: r.promptFr }]))
}

// ensureSentences complète le cache local pour un verbe à un temps. Rend true
// si quelque chose a été récupéré, pour que l'appelant sache s'il doit
// recharger sa carte.
export async function ensureSentences(
  lang: string,
  lemma: string,
  tense: string,
  forms: { person: string; form: string }[],
  local: SentenceMap,
): Promise<boolean> {
  const missing = forms.some((f) => !local.has(key(lemma, tense, f.person)))
  if (!missing) return false

  try {
    const sentences = await fetchSentences({ lang, lemma, tense, forms })
    if (sentences.length === 0) return false

    const stored: StoredSentence[] = sentences.map((s) => ({
      lemma,
      tense,
      person: s.person,
      prompt: s.prompt,
      promptFr: s.prompt_fr,
    }))
    await saveSentences(lang, stored)
    return true
  } catch {
    // Génération indisponible (pas de clé, quota, hors ligne) : la leçon se
    // fait avec les énoncés locaux. Un exercice moins riche vaut mieux qu'un
    // écran bloqué.
    return false
  }
}
