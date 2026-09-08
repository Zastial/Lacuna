<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import EpisodeListView from './views/EpisodeListView.vue'
import TransportView from './views/TransportView.vue'
import RevueView from './views/RevueView.vue'
import FondationsView from './views/FondationsView.vue'
import CultureGView from './views/CultureGView.vue'
import ArticlesView from './views/ArticlesView.vue'
import SettingsView from './views/SettingsView.vue'
import { useRevueStore } from './stores/revue'
import { useFondationsStore } from './stores/fondations'
import { useCultureGStore } from './stores/cultureg'
import { useSettingsStore } from './stores/settings'
import { syncNow } from './services/sync'
import { syncNotifications } from './services/notifications'
import type { LocalEpisode } from './types/models'

type Screen = 'list' | 'transport' | 'revue' | 'fondations' | 'cultureg' | 'articles' | 'settings'

const screen = ref<Screen>('list')
const openEpisode = ref<LocalEpisode | null>(null)

const revue = useRevueStore()
const fondations = useFondationsStore()
const cultureg = useCultureGStore()
const settings = useSettingsStore()

let refreshInterval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  // Best-effort, jamais bloquant pour l'affichage (§3.2 : hors ligne = cas
  // normal). Pousse ce qui traîne d'une session précédente puis restaure
  // ce qui manquerait après une réinstallation (§3.1/§6.4).
  void syncNow()
  void revue.refreshDueCount()
  void fondations.init()
  void cultureg.refreshDueCount()
  // La phrase du jour et le nombre de cartes dues changent chaque jour :
  // on reprogramme à chaque ouverture pour que la notification de demain
  // reflète l'état d'aujourd'hui.
  void settings.load().then(() => syncNotifications(settings.$state))
  refreshInterval = setInterval(() => {
    void revue.refreshDueCount()
    void cultureg.refreshDueCount()
  }, 30_000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

function onOpen(episode: LocalEpisode): void {
  openEpisode.value = episode
  screen.value = 'transport'
}

function onBack(): void {
  openEpisode.value = null
  screen.value = 'list'
}
</script>

<template>
  <!-- mode="out-in" : les écrans occupent tout l'espace, les croiser
       produirait un chevauchement au lieu d'un enchaînement. -->
  <Transition name="screen" mode="out-in">
    <TransportView v-if="screen === 'transport' && openEpisode" :episode="openEpisode" @back="onBack" />
    <FondationsView v-else-if="screen === 'fondations'" @back="onBack" />
    <RevueView v-else-if="screen === 'revue'" @back="onBack" />
    <CultureGView v-else-if="screen === 'cultureg'" @back="onBack" />
    <ArticlesView v-else-if="screen === 'articles'" @back="onBack" />
    <SettingsView v-else-if="screen === 'settings'" @back="onBack" />
    <EpisodeListView
      v-else
      @open="onOpen"
      @fondations="screen = 'fondations'"
      @revue="screen = 'revue'"
      @cultureg="screen = 'cultureg'"
      @articles="screen = 'articles'"
      @settings="screen = 'settings'"
    />
  </Transition>
</template>
