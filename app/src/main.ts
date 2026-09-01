import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

declare global {
  interface Window {
    __lacunaMounted?: boolean
  }
}
window.__lacunaMounted = true

// Un écran blanc silencieux est le pire résultat possible sur un appareil
// sans Safari Web Inspector à portée de main : toute erreur non rattrapée
// s'affiche directement dans la page plutôt que de rester invisible.
function showFatalError(err: unknown): void {
  const el = document.getElementById('app')
  if (!el) return
  const message = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)
  el.innerHTML = `<pre style="white-space:pre-wrap;padding:1rem;padding-top:calc(1rem + env(safe-area-inset-top));color:#c00;font-size:0.8rem;">${message.replace(/</g, '&lt;')}</pre>`
}

window.addEventListener('error', (e) => showFatalError(e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => showFatalError(e.reason))

try {
  const app = createApp(App)
  app.config.errorHandler = (err) => showFatalError(err)
  app.use(createPinia()).mount('#app')
} catch (err) {
  showFatalError(err)
}
