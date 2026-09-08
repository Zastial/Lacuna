<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import HomeView from './views/HomeView.vue'
import OnboardingView from './views/OnboardingView.vue'
import FondationsView from './views/FondationsView.vue'
import CultureGView from './views/CultureGView.vue'
import ParlerView from './views/ParlerView.vue'
import ArticlesView from './views/ArticlesView.vue'
import SettingsView from './views/SettingsView.vue'
import ErrorToast from './components/ErrorToast.vue'
import { useFondationsStore } from './stores/fondations'
import { useCultureGStore } from './stores/cultureg'
import { useSettingsStore } from './stores/settings'
import { useVideosStore } from './stores/videos'
import { syncNotifications } from './services/notifications'

type Screen = 'home' | 'fondations' | 'parler' | 'cultureg' | 'articles' | 'settings'

const screen = ref<Screen>('home')

const fondations = useFondationsStore()
const cultureg = useCultureGStore()
const settings = useSettingsStore()
const videos = useVideosStore()

let refreshInterval: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  void fondations.init()
  void cultureg.refreshDueCount()
  refreshInterval = setInterval(() => {
    void cultureg.refreshDueCount()
  }, 30_000)

  // Chargé avant tout affichage : c'est ce réglage qui décide si on montre
  // l'onboarding ou l'accueil, et un faux départ sur l'accueil se verrait.
  await settings.load()

  // L'écran de chargement ne part qu'ici, pas au montage de Vue : c'est
  // settings.load() qui détermine onboarding ou accueil, et le thème forcé.
  // Le retirer plus tôt montrerait le mauvais écran une fraction de seconde.
  dismissSplash()
  // Les écrans mono-langue s'ouvrent sur la première langue suivie : garder
  // 'it' en dur donnerait un écran hors sujet à qui n'apprend que l'espagnol.
  void fondations.setLang(settings.primaryLang)
  void cultureg.setLang(settings.primaryLang)
  // Pas avant l'onboarding : demander l'autorisation de notifier sur le
  // tout premier écran, avant que l'utilisateur sache ce qu'est l'app, est
  // le meilleur moyen de se faire refuser une bonne fois pour toutes.
  if (settings.onboarded) void syncNotifications(settings.$state)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

// Le splash vit dans index.html, hors de l'app Vue : il doit être peint
// avant que le bundle n'arrive. On le retire donc à la main.
function dismissSplash(): void {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('gone')
  // Retiré du DOM après la transition, pas seulement rendu transparent :
  // un calque en position fixed sur toute la page intercepterait les taps.
  setTimeout(() => splash.remove(), 400)
}

function onBack(): void {
  screen.value = 'home'
}

// À la fin de l'onboarding, les centres d'intérêt viennent d'être choisis :
// le fil doit être rechargé, sinon l'accueil montrerait le résultat des
// réglages par défaut.
async function onOnboardingDone(): Promise<void> {
  await videos.fetch()
  // L'utilisateur vient de choisir sa langue et ses sujets : la demande
  // d'autorisation arrive maintenant, quand elle a un sens.
  void syncNotifications(settings.$state)
}
</script>

<template>
  <OnboardingView v-if="settings.loaded && !settings.onboarded" @done="onOnboardingDone" />

  <!-- mode="out-in" : les écrans occupent tout l'espace, les croiser
       produirait un chevauchement au lieu d'un enchaînement. -->
  <Transition v-else name="screen" mode="out-in">
    <FondationsView v-if="screen === 'fondations'" @back="onBack" />
    <ParlerView v-else-if="screen === 'parler'" @back="onBack" />
    <CultureGView v-else-if="screen === 'cultureg'" @back="onBack" />
    <ArticlesView v-else-if="screen === 'articles'" @back="onBack" />
    <SettingsView v-else-if="screen === 'settings'" @back="onBack" />
    <HomeView
      v-else
      @fondations="screen = 'fondations'"
      @parler="screen = 'parler'"
      @cultureg="screen = 'cultureg'"
      @articles="screen = 'articles'"
      @settings="screen = 'settings'"
    />
  </Transition>

  <!-- Hors de la Transition : la bannière doit survivre au changement
       d'écran, sinon une erreur déclenchée par une navigation disparaîtrait
       avec l'écran qui l'a provoquée. -->
  <ErrorToast />
</template>
