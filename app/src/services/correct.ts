import { correctSentence, correctionEnabled } from '../api/client'

export interface CorrectionResult {
  ok: boolean
  corrected: string
  explanation: string
}

// La correction dépend d'une clé côté serveur. On demande au backend s'il
// l'a plutôt que de le supposer : sans elle, l'app masque le bouton au lieu
// de laisser l'utilisateur buter dessus.
export async function isCorrectionAvailable(): Promise<boolean> {
  try {
    return await correctionEnabled()
  } catch {
    return false
  }
}

export async function correct(
  lang: string,
  expected: string,
  expectedFr: string,
  said: string,
): Promise<CorrectionResult | null> {
  try {
    return await correctSentence({ lang, expected, expected_fr: expectedFr, said })
  } catch {
    // Le palier gratuit a des limites de débit : un échec ici est attendu
    // en usage normal. L'exercice continue avec la seule comparaison
    // littérale, il ne s'arrête pas.
    return null
  }
}
