// Pont vers le plugin natif de traduction (App/LacunaTranslatePlugin.swift).
// Tout se passe sur l'appareil : détection via NaturalLanguage, traduction
// via le framework Translation d'Apple. Aucun appel réseau, aucune clé.
import { registerPlugin } from '@capacitor/core'

export type AvailabilityStatus = 'installed' | 'supported' | 'unsupported'

interface LacunaTranslatePlugin {
  detect(options: { text: string }): Promise<{ lang: string | null; confidence: number }>
  availability(options: { source: string; target: string }): Promise<{
    status: AvailabilityStatus
    reason?: string
  }>
  prepare(options: { source: string; target: string }): Promise<{ prepared: boolean }>
  translate(options: { text: string; source: string; target: string }): Promise<{ text: string }>
}

const LacunaTranslate = registerPlugin<LacunaTranslatePlugin>('LacunaTranslate')

// La langue de l'utilisateur. Le flux L'Équipe publie en français : c'est
// cette langue-là qu'on reconnaît pour décider s'il y a lieu de traduire.
export const NATIVE_LANG = 'fr'

// Le plugin n'existe pas sur le web (npm run dev dans un navigateur) et le
// framework Translation demande iOS 18. Dans les deux cas on veut une
// réponse nette plutôt qu'une exception qui remonte jusqu'à l'UI.
export async function translationStatus(target: string): Promise<AvailabilityStatus> {
  try {
    const { status } = await LacunaTranslate.availability({ source: NATIVE_LANG, target })
    return status
  } catch {
    return 'unsupported'
  }
}

export async function detectLang(text: string): Promise<string | null> {
  try {
    const { lang } = await LacunaTranslate.detect({ text })
    return lang
  } catch {
    return null
  }
}

// Déclenche le téléchargement du modèle de langue. iOS affiche sa propre
// confirmation : c'est l'utilisateur qui accepte le téléchargement.
export async function prepareTranslation(target: string): Promise<boolean> {
  try {
    const { prepared } = await LacunaTranslate.prepare({ source: NATIVE_LANG, target })
    return prepared
  } catch {
    return false
  }
}

// translateFromNative applique la règle demandée : on ne traduit que ce qui
// est écrit dans la langue de l'utilisateur. Un titre déjà en italien n'a
// rien à y gagner, et le traduire donnerait un résultat absurde.
export async function translateFromNative(text: string, target: string): Promise<string | null> {
  const detected = await detectLang(text)
  if (detected !== NATIVE_LANG) return null
  try {
    const result = await LacunaTranslate.translate({ text, source: NATIVE_LANG, target })
    return result.text
  } catch {
    return null
  }
}
