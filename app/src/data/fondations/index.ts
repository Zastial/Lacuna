import type { ConjugItem, Scenario } from '../../types/models'
import { IT_SCENARIOS } from './it'
import { ES_SCENARIOS } from './es'

export const SCENARIOS_BY_LANG: Record<string, Scenario[]> = {
  it: IT_SCENARIOS,
  es: ES_SCENARIOS,
}

export function scenariosForLang(lang: string): Scenario[] {
  return SCENARIOS_BY_LANG[lang] ?? []
}

export function findScenario(id: string): Scenario | null {
  for (const list of Object.values(SCENARIOS_BY_LANG)) {
    const found = list.find((s) => s.id === id)
    if (found) return found
  }
  return null
}

// Un même ConjugItem.id peut apparaître dans plusieurs scénarios (repris pour
// l'entrelacement) — dédupliqué ici pour l'entraînement rapide, qui pioche
// par id de révision sans passer par un scénario particulier.
export function allConjugItemsForLang(lang: string): ConjugItem[] {
  const byId = new Map<string, ConjugItem>()
  for (const scenario of scenariosForLang(lang)) {
    for (const item of scenario.conjugation) {
      byId.set(item.id, item)
    }
  }
  return [...byId.values()]
}

export function findConjugItem(lang: string, itemId: string): ConjugItem | null {
  return allConjugItemsForLang(lang).find((i) => i.id === itemId) ?? null
}
