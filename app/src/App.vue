<script setup lang="ts">
import { ref } from 'vue'
import EpisodeListView from './views/EpisodeListView.vue'
import TransportView from './views/TransportView.vue'
import type { LocalEpisode } from './types/models'

const openEpisode = ref<LocalEpisode | null>(null)

function onOpen(episode: LocalEpisode): void {
  openEpisode.value = episode
}

function onBack(): void {
  openEpisode.value = null
}
</script>

<template>
  <TransportView v-if="openEpisode" :episode="openEpisode" @back="onBack" />
  <EpisodeListView v-else @open="onOpen" />
</template>
