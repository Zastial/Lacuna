<script setup lang="ts">
import { onMounted } from 'vue'
import { useEpisodesStore } from '../stores/episodes'
import type { ApiEpisode, LocalEpisode } from '../types/models'

const episodes = useEpisodesStore()

const emit = defineEmits<{ open: [episode: LocalEpisode] }>()

onMounted(async () => {
  await episodes.refreshDownloaded()
  await episodes.fetchRemote()
})

function isDownloaded(remote: ApiEpisode): boolean {
  return episodes.downloaded.some((e) => e.id === remote.id)
}

async function onDownload(remote: ApiEpisode): Promise<void> {
  await episodes.download(remote)
}

function onOpenDownloaded(local: LocalEpisode): void {
  emit('open', local)
}

async function onOpenAfterDownload(remote: ApiEpisode): Promise<void> {
  await onDownload(remote)
  const local = episodes.downloaded.find((e) => e.id === remote.id)
  if (local) emit('open', local)
}
</script>

<template>
  <div class="list">
    <h1>Lacuna</h1>

    <section v-if="episodes.downloaded.length > 0">
      <h2>Téléchargés</h2>
      <ul>
        <li v-for="ep in episodes.downloaded" :key="ep.id">
          <button class="ep-btn" @click="onOpenDownloaded(ep)">{{ ep.title }}</button>
        </li>
      </ul>
    </section>

    <section>
      <h2>Disponibles</h2>
      <p v-if="episodes.loadingRemote">Chargement…</p>
      <p v-else-if="episodes.error" class="error">{{ episodes.error }}</p>
      <ul>
        <li v-for="ep in episodes.remote" :key="ep.id">
          <template v-if="isDownloaded(ep)">
            <button class="ep-btn" @click="onOpenDownloaded(episodes.downloaded.find((d) => d.id === ep.id)!)">
              {{ ep.title }} ✓
            </button>
          </template>
          <template v-else-if="episodes.downloadingId === ep.id">
            <div class="ep-btn downloading">
              {{ ep.title }} — {{ Math.round(episodes.downloadProgress * 100) }}%
            </div>
          </template>
          <template v-else>
            <button class="ep-btn" @click="onOpenAfterDownload(ep)">
              {{ ep.title }} — télécharger
            </button>
          </template>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.list {
  padding: 1rem;
  padding-top: calc(1rem + env(safe-area-inset-top));
  max-width: 480px;
  margin: 0 auto;
}
h1 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}
h2 {
  font-size: 1rem;
  opacity: 0.7;
  margin: 1.5rem 0 0.5rem;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ep-btn {
  width: 100%;
  text-align: left;
  padding: 0.9rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid #3333;
  background: #8881;
  font-size: 1rem;
  cursor: pointer;
}
.ep-btn.downloading {
  opacity: 0.6;
}
.error {
  color: #d33;
}
</style>
