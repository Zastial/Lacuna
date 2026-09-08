<script setup lang="ts">
import { onMounted } from 'vue'
import { Browser } from '@capacitor/browser'
import { useVideosStore } from '../stores/videos'
import { useSettingsStore } from '../stores/settings'
import { useFondationsStore } from '../stores/fondations'
import { useCultureGStore } from '../stores/cultureg'
import { ERROR_TEXT, reportError } from '../services/toast'
import type { ApiVideo } from '../types/models'

const emit = defineEmits<{
  fondations: []
  cultureg: []
  articles: []
  settings: []
}>()

const videos = useVideosStore()
const settings = useSettingsStore()
const fondations = useFondationsStore()
const cultureg = useCultureGStore()

onMounted(async () => {
  if (!settings.loaded) await settings.load()
  // La langue des vidéos suit celle choisie à l'onboarding : proposer de
  // l'italien à quelqu'un qui apprend l'espagnol n'aurait aucun sens.
  videos.lang = settings.targetLang
  await videos.fetch()
})

// Les vidéos s'ouvrent dans YouTube, pas dans un lecteur intégré : l'embed
// tiers casse régulièrement (vidéos bloquées hors du site), et l'app native
// gère déjà le plein écran, les sous-titres et la reprise de lecture.
async function openVideo(video: ApiVideo): Promise<void> {
  try {
    await Browser.open({ url: `https://www.youtube.com/watch?v=${video.youtube_id}` })
  } catch (err) {
    reportError(err, () => openVideo(video))
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="home">
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
      <button class="nav-btn pill gold" @click="emit('cultureg')">
        <span class="nav-label">Culture G</span>
        <span v-if="cultureg.dueCount > 0" class="nav-badge">{{ cultureg.dueCount }}</span>
      </button>
      <button class="nav-btn pill plum" @click="emit('articles')">
        <span class="nav-label">Articles</span>
      </button>
    </nav>

    <section>
      <p class="label section-label">À regarder</p>

      <p v-if="videos.loading" class="hint">Chargement…</p>
      <p v-else-if="videos.error" class="error">
        {{ ERROR_TEXT }}
        <button class="inline-retry" @click="videos.fetch()">Réessayer</button>
      </p>
      <p v-else-if="videos.videos.length === 0" class="hint">
        Aucune vidéo pour ces centres d'intérêt. Tu peux en ajouter dans les réglages.
      </p>

      <ul>
        <li v-for="v in videos.videos" :key="v.id">
          <button class="glass video-btn" @click="openVideo(v)">
            <img v-if="v.thumbnail_url" class="thumb" :src="v.thumbnail_url" :alt="''" loading="lazy" />
            <span class="meta-row">
              <span class="channel">{{ v.channel_name }}</span>
              <span class="date">{{ formatDate(v.published_at) }}</span>
            </span>
            <span class="title">{{ v.title }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
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
.main-nav {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}
.nav-btn {
  position: relative;
  padding: 1.1rem;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.2rem;
  cursor: pointer;
}
.nav-btn.teal {
  background: var(--teal);
  color: var(--on-teal);
}
.nav-btn.gold {
  background: var(--gold);
  color: var(--on-gold);
}
.nav-btn.plum {
  background: var(--plum);
  color: var(--on-plum);
}
.nav-badge {
  position: absolute;
  top: -6px;
  right: 10px;
  min-width: 1.6rem;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 700;
}
.section-label {
  margin-bottom: 0.6rem;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.video-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 0;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  color: var(--ink);
}
.thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 1rem;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.title {
  padding: 0 1rem 1rem;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 1.02rem;
  line-height: 1.4;
}
.hint {
  color: var(--ink-soft);
}
.error {
  color: var(--coral-ink);
}
.inline-retry {
  margin-left: 0.5rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--coral-ink);
  font-weight: 600;
  cursor: pointer;
}
</style>
