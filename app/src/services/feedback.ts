// Vocabulaire haptique volontairement réduit. La littérature UX est
// constante là-dessus : vibrer à chaque interaction pousse les gens à
// désactiver l'haptique du système, ce qui fait perdre le signal partout.
// On ne vibre donc que sur les trois moments qui portent une information :
// une réponse jugée, une capture enregistrée, une série terminée.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Toutes les fonctions sont "best effort" : sur un appareil sans moteur
// haptique (ou dans le navigateur), l'échec ne doit jamais casser le flux.
async function safe(run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch {
    // pas d'haptique disponible : on continue silencieusement
  }
}

export function tapFeedback(): Promise<void> {
  return safe(() => Haptics.impact({ style: ImpactStyle.Light }))
}

export function correctFeedback(): Promise<void> {
  return safe(() => Haptics.notification({ type: NotificationType.Success }))
}

export function wrongFeedback(): Promise<void> {
  return safe(() => Haptics.notification({ type: NotificationType.Warning }))
}

export function completionFeedback(): Promise<void> {
  return safe(() => Haptics.impact({ style: ImpactStyle.Medium }))
}

// prefersReducedMotion : respecté partout où on anime. Une personne qui a
// activé ce réglage système ne doit voir aucune transition.
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
