<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useVideosStore } from '../stores/videos'
import { useSettingsStore } from '../stores/settings'
import { useFondationsStore } from '../stores/fondations'
import { useCultureGStore } from '../stores/cultureg'
import LacunaMark from '../components/LacunaMark.vue'
import { openYouTube } from '../services/links'
import { ERROR_TEXT, reportError } from '../services/toast'
import type { ApiVideo } from '../types/models'

const emit = defineEmits<{
  fondations: []
  parler: []
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
  await videos.fetch()
})

// Direction l'app YouTube, pas un lecteur intégré : l'embed tiers casse sur
// les vidéos bloquées hors du site, et l'app native gère déjà plein écran,
// sous-titres et reprise de lecture. Le repli web est dans services/links.
async function openVideo(video: ApiVideo): Promise<void> {
  try {
    await openYouTube(video.youtube_id)
  } catch (err) {
    reportError(err, () => openVideo(video))
  }
}

// La marque remplace le mot « Lacuna » en tête : le nom est déjà sur
// l'icône de l'app et sur l'écran d'accueil du téléphone, le répéter ne
// disait rien. À la place, un salut qui situe le moment de la journée.
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
})

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="home">
    <header class="top">
      <LacunaMark :size="46" />
      <p class="greeting">{{ greeting }}</p>
      <button class="settings-btn" aria-label="Réglages" @click="emit('settings')">⚙</button>
    </header>

    <nav class="main-nav">
      <button class="nav-btn pill teal" @click="emit('fondations')">
        <span class="nav-label">Fondations</span>
        <span v-if="fondations.dueCount > 0" class="nav-badge">{{ fondations.dueCount }}</span>
      </button>
      <button class="nav-btn pill coral" @click="emit('parler')">
        <span class="nav-label">Parler</span>
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

      <p v-if="videos.loading" class="loading">Chargement…</p>
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
  gap: 0.85rem;
  padding: 0.4rem 0.25rem;
  margin-bottom: 1.5rem;
}
.greeting {
  flex: 1;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0;
  color: var(--teal-ink);
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
.nav-btn.coral {
  background: var(--coral);
  color: var(--on-coral);
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
