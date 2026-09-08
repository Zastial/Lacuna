<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useEpisodesStore } from '../stores/episodes'
import { useRevueStore } from '../stores/revue'
import { useFondationsStore } from '../stores/fondations'
import { useCultureGStore } from '../stores/cultureg'
import type { ApiEpisode, LocalEpisode } from '../types/models'

const episodes = useEpisodesStore()
const revue = useRevueStore()
const fondations = useFondationsStore()
const cultureg = useCultureGStore()

const emit = defineEmits<{
  open: [episode: LocalEpisode]
  fondations: []
  revue: []
  cultureg: []
  articles: []
  settings: []
}>()

const PAGE_SIZE = 10
const visibleCount = ref(PAGE_SIZE)
const visibleRemote = computed(() => episodes.remote.slice(0, visibleCount.value))
const hasMore = computed(() => episodes.remote.length > visibleCount.value)

function loadMore(): void {
  visibleCount.value += PAGE_SIZE
}

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

async function onDelete(ep: LocalEpisode, event: Event): Promise<void> {
  event.stopPropagation()
  const ok = window.confirm(`Supprimer « ${ep.title} » ?\nLes captures et la progression de révision liées seront perdues.`)
  if (!ok) return
  await episodes.remove(ep.id)
  await revue.refreshDueCount()
}
</script>

<template>
  <div class="list">
    <header class="top glass">
      <div class="top-text">
        <p class="wordmark">Lacuna</p>
        <p class="label">Ton compagnon de langues</p>
      </div>
      <button class="settings-btn" aria-label="Réglages" @click="emit('settings')">⚙</button>
    </header>

    <nav class="main-nav">
      <button class="nav-btn pill teal" @click="emit('fondations')">
        <span class="nav-label">Fondations</span>
        <span v-if="fondations.dueDrillCount > 0" class="nav-badge">{{ fondations.dueDrillCount }}</span>
      </button>
      <button class="nav-btn pill coral" @click="emit('revue')">
        <span class="nav-label">Réviser</span>
        <span v-if="revue.dueCount > 0" class="nav-badge">{{ revue.dueCount }}</span>
      </button>
      <button class="nav-btn pill gold" @click="emit('cultureg')">
        <span class="nav-label">Culture G</span>
        <span v-if="cultureg.dueCount > 0" class="nav-badge">{{ cultureg.dueCount }}</span>
      </button>
      <button class="nav-btn pill plum" @click="emit('articles')">
        <span class="nav-label">Articles</span>
      </button>
    </nav>

    <section v-if="episodes.downloaded.length > 0">
      <p class="label section-label">Téléchargés</p>
      <ul>
        <li v-for="ep in episodes.downloaded" :key="ep.id" class="ep-row">
          <button class="glass ep-btn" @click="onOpenDownloaded(ep)">{{ ep.title }}</button>
          <button class="delete-btn" aria-label="Supprimer" @click="onDelete(ep, $event)">✕</button>
        </li>
      </ul>
    </section>

    <section>
      <p class="label section-label">Disponibles</p>
      <p v-if="episodes.loadingRemote" class="hint">Chargement…</p>
      <p v-else-if="episodes.error" class="error">{{ episodes.error }}</p>
      <ul>
        <li v-for="ep in visibleRemote" :key="ep.id">
          <template v-if="isDownloaded(ep)">
            <button class="glass ep-btn done" @click="onOpenDownloaded(episodes.downloaded.find((d) => d.id === ep.id)!)">
              <span>{{ ep.title }}</span>
              <span class="check-badge">✓</span>
            </button>
          </template>
          <template v-else-if="episodes.downloadingId === ep.id">
            <div class="glass ep-btn downloading">
              {{ ep.title }} — {{ Math.round(episodes.downloadProgress * 100) }}%
            </div>
          </template>
          <template v-else>
            <button class="glass ep-btn" @click="onOpenAfterDownload(ep)">
              {{ ep.title }} — télécharger
            </button>
          </template>
        </li>
      </ul>
      <button v-if="hasMore" class="load-more" @click="loadMore">Charger plus</button>
    </section>
  </div>
</template>

<style scoped>
.list {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  padding-top: calc(1rem + env(safe-area-inset-top));
  max-width: 480px;
  margin: 0 auto;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  margin-bottom: 1.25rem;
}
.settings-btn {
  flex: none;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink-soft);
  font-size: 1.1rem;
  cursor: pointer;
}
.wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.6rem;
  margin: 0;
  color: var(--teal-ink);
}
.top .label {
  margin-top: 0.3rem;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  color: var(--ink-soft);
}
.main-nav {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}
.nav-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.05rem;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.1rem;
  cursor: pointer;
}
.nav-btn.teal {
  color: var(--on-teal);
  background: var(--teal);
}
.nav-btn.coral {
  color: var(--on-coral);
  background: var(--coral);
}
.nav-btn.gold {
  color: var(--on-gold);
  background: var(--gold);
}
.nav-btn.plum {
  color: var(--on-plum);
  background: var(--plum);
}
.nav-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--glass-strong);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
}
.section-label {
  margin: 1.5rem 0 0.6rem;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.ep-row {
  display: flex;
  gap: 0.5rem;
}
.ep-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  text-align: left;
  padding: 0.9rem 1.1rem;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
}
.ep-btn.downloading {
  color: var(--ink-soft);
}
.delete-btn {
  flex-shrink: 0;
  width: 3rem;
  border-radius: 14px;
  border: none;
  background: var(--coral-wash);
  color: var(--coral-ink);
  font-size: 1.1rem;
  cursor: pointer;
}
.load-more {
  width: 100%;
  margin-top: 0.6rem;
  padding: 0.75rem;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: none;
  color: var(--ink-soft);
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
}
.hint {
  color: var(--ink-soft);
}
.error {
  color: var(--coral-ink);
}
</style>
