import { reactive } from 'vue'

// Message volontairement générique : sur un téléphone, un message technique
// ne dit rien d'actionnable à celui qui l'utilise. Le détail part dans la
// console, où il reste consultable via le Web Inspector.
//
// Deux formulations pour un même incident : sans bouton, la phrase porte
// elle-même l'invitation à réessayer ; avec un bouton « Réessayer », la
// répéter dans le texte ferait bégayer l'interface.
export const ERROR_MESSAGE = 'Une erreur est survenue. Réessayer'
export const ERROR_TEXT = 'Une erreur est survenue.'

interface ToastState {
  visible: boolean
  // Action de reprise quand l'appelant en connaît une. Sans elle, la
  // bannière n'affiche pas de bouton « Réessayer » : proposer une reprise
  // qui ne relance rien serait mentir sur ce que fait le bouton.
  retry: (() => unknown) | null
}

export const toast = reactive<ToastState>({ visible: false, retry: null })

let hideTimer: ReturnType<typeof setTimeout> | undefined

export function reportError(err: unknown, retry?: () => unknown): void {
  console.error('[lacuna]', err)

  if (hideTimer) clearTimeout(hideTimer)
  toast.retry = retry ?? null
  toast.visible = true

  // Sans reprise possible, il n'y a rien à faire de la bannière : elle
  // s'efface seule. Avec une reprise, elle attend une décision.
  if (!toast.retry) {
    hideTimer = setTimeout(dismissToast, 6000)
  }
}

export function dismissToast(): void {
  if (hideTimer) clearTimeout(hideTimer)
  toast.visible = false
  toast.retry = null
}

export async function runRetry(): Promise<void> {
  const retry = toast.retry
  dismissToast()
  if (!retry) return
  try {
    await retry()
  } catch (err) {
    reportError(err, retry)
  }
}
