import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { reportError } from './services/toast'
import './style.css'

declare global {
  interface Window {
    __lacunaMounted?: boolean
  }
}
window.__lacunaMounted = true

let mounted = false

// Avant le montage, aucune bannière ne peut s'afficher : il n'y a pas encore
// d'application pour la rendre. Un écran blanc silencieux étant le pire
// résultat possible sur un téléphone sans Web Inspector à portée de main, on
// garde ici — et seulement ici — l'affichage brut dans la page.
function showFatalError(err: unknown): void {
  const el = document.getElementById('app')
  if (!el) return
  const message = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)
  el.innerHTML = `<pre style="white-space:pre-wrap;padding:1rem;padding-top:calc(1rem + env(safe-area-inset-top));color:#c00;font-size:0.8rem;">${message.replace(/</g, '&lt;')}</pre>`
}

// Une fois l'app montée, une erreur ne doit plus détruire l'écran en cours :
// l'utilisateur perdrait sa session de révision pour un incident souvent
// passager. Elle devient une bannière, et l'app reste utilisable.
function handleError(err: unknown): void {
  if (mounted) reportError(err)
  else showFatalError(err)
}

window.addEventListener('error', (e) => handleError(e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => handleError(e.reason))

try {
  const app = createApp(App)
  app.config.errorHandler = (err) => handleError(err)
  app.use(createPinia()).mount('#app')
  mounted = true
} catch (err) {
  showFatalError(err)
}
