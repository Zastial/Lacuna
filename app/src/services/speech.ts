import { registerPlugin } from '@capacitor/core'

export interface SpeechAvailability {
  supported: boolean
  // Vrai quand la langue est installée sur l'appareil : la dictée reste alors
  // hors ligne. Sinon iOS passe par ses serveurs, donc du réseau est requis.
  onDevice: boolean
}

interface LacunaSpeechPlugin {
  availability(options: { lang: string }): Promise<SpeechAvailability>
  requestPermission(): Promise<{ granted: boolean; reason: string }>
  start(options: { lang: string }): Promise<{ started: boolean; onDevice: boolean }>
  stop(): Promise<{ text: string }>
  addListener(
    event: 'partial',
    cb: (data: { text: string; final: boolean }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const LacunaSpeech = registerPlugin<LacunaSpeechPlugin>('LacunaSpeech')

export async function speechAvailability(lang: string): Promise<SpeechAvailability> {
  try {
    return await LacunaSpeech.availability({ lang })
  } catch {
    // Plugin absent (web, ou build sans le natif).
    return { supported: false, onDevice: false }
  }
}

export async function requestSpeechPermission(): Promise<boolean> {
  try {
    const { granted } = await LacunaSpeech.requestPermission()
    return granted
  } catch {
    return false
  }
}

// listen ouvre le micro et rend une fonction d'arrêt qui livre la
// transcription finale. Les résultats partiels arrivent au fil de l'eau :
// voir ses mots s'écrire rend l'attente supportable et prouve que le micro
// est vivant.
export async function listen(
  lang: string,
  onPartial: (text: string) => void,
): Promise<() => Promise<string>> {
  const handle = await LacunaSpeech.addListener('partial', (d) => onPartial(d.text))
  await LacunaSpeech.start({ lang })

  return async () => {
    const { text } = await LacunaSpeech.stop()
    await handle.remove()
    return text
  }
}

// normalise pour comparer ce qui a été dit à ce qui était attendu : la
// dictée ne rend ni la ponctuation ni la casse de façon fiable, et s'arrêter
// là-dessus ferait échouer des réponses parfaites à l'oral.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matches(said: string, expected: string): boolean {
  return normalize(said) === normalize(expected)
}
