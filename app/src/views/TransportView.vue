<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getSegments } from '../db/repository'
import { tapFeedback } from '../services/feedback'
import type { LocalEpisode, LocalSegment } from '../types/models'

const props = defineProps<{ episode: LocalEpisode }>()
const emit = defineEmits<{ back: [] }>()

const player = usePlayerStore()
const segments = ref<LocalSegment[]>([])
const subtitlesOn = ref(true)

onMounted(async () => {
  await player.load(props.episode)
  segments.value = await getSegments(props.episode.id)
  player.play()
})

// Le transcript n'existe qu'en langue cible (celle du flux podcast) — aucune
// traduction française n'est disponible pour de l'audio arbitraire, à la
// différence des dialogues FONDATIONS entièrement rédigés à la main.
//
// On affiche le dernier segment dont start_ms <= t, pas une fenêtre stricte
// [start,end) : les cues mergées laissent de petits trous entre elles (silences,
// cues filtrées), et une fenêtre stricte y affiche un blanc qui clignote à
// chaque transition — ça donne l'impression que les sous-titres se figent ou
// décrochent du son. Rester sur le dernier segment démarré jusqu'au suivant
// est le comportement standard des sous-titres et élimine ce clignotement.
const currentSubtitle = computed(() => {
  const t = player.currentTimeMs
  let current: LocalSegment | null = null
  for (const s of segments.value) {
    if (s.startMs > t) break
    current = s
  }
  return current?.text ?? ''
})

// Certains flux (pub dynamique insérée côté hébergeur, ex. Podtrac) servent
// un fichier audio réel plus long que la version sur laquelle le transcript
// a été généré : au-delà du premier bloc de pub, tous les timestamps
// décalent par rapport au son. On compare la durée réelle du fichier
// téléchargé (disponible une fois les métadonnées audio chargées) à la
// durée déclarée par le flux (qui correspond à la couverture du transcript)
// plutôt que de laisser croire que les sous-titres sont fiables.
const subtitleDriftSuspected = computed(() => {
  const real = player.durationMs
  const declared = props.episode.durationS ? props.episode.durationS * 1000 : 0
  if (!real || !declared) return false
  return Math.abs(real - declared) / declared > 0.1
})

onUnmounted(() => {
  player.pause()
})

async function onCapture(): Promise<void> {
  // Accusé de réception tactile sans interrompre l'écoute (utilisable les
  // yeux fermés, téléphone en poche). Haptique native plutôt que
  // navigator.vibrate, absent de WKWebView sur iOS.
  void tapFeedback()
  await player.capture('not_understood')
}

function togglePlay(): void {
  if (player.isPlaying) player.pause()
  else player.play()
}

const progress = computed(() => {
  if (!player.durationMs) return 0
  return Math.min(1, player.currentTimeMs / player.durationMs)
})

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="transport">
    <header>
      <button class="back" @click="emit('back')">←</button>
      <span class="title">{{ episode.title }}</span>
      <button class="sub-toggle" @click="subtitlesOn = !subtitlesOn">
        {{ subtitlesOn ? 'Sous-titres on' : 'Sous-titres off' }}
      </button>
    </header>

    <div v-if="subtitlesOn" class="subtitle-bar">
      <p v-if="subtitleDriftSuspected" class="subtitle-warning">
        ⚠ Ce fichier semble contenir des pubs insérées après coup : les sous-titres peuvent décrocher au fil de l'épisode.
      </p>
      <p>{{ currentSubtitle }}</p>
    </div>

    <button v-show="!player.checkpointPending" class="capture-zone" @click="onCapture">
      <span class="capture-label">j'ai pas capté</span>
      <span class="capture-count" v-if="player.captureCount > 0">{{ player.captureCount }} capturé{{ player.captureCount > 1 ? 's' : '' }}</span>
    </button>

    <footer>
      <div class="progress"><div class="progress-fill" :style="{ width: `${progress * 100}%` }" /></div>
      <div class="controls">
        <span class="time">{{ formatTime(player.currentTimeMs) }}</span>
        <button class="play-pause" @click="togglePlay">{{ player.isPlaying ? '⏸' : '▶' }}</button>
        <span class="time">{{ formatTime(player.durationMs) }}</span>
      </div>
    </footer>

    <div v-show="player.checkpointPending" class="checkpoint-overlay">
      <p>Toujours là ?</p>
      <div class="checkpoint-actions">
        <button @click="player.resumeAfterCheckpoint('replay')">↺ Rejouer 15s</button>
        <button @click="player.resumeAfterCheckpoint('continue')">Continuer →</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transport {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  color: var(--ink);
}
header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  padding-top: calc(0.75rem + env(safe-area-inset-top));
}
.back {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--ink);
}
.title {
  flex: 1;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 0.95rem;
  color: var(--ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-toggle {
  flex-shrink: 0;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
  color: var(--ink-soft);
}
.subtitle-bar {
  min-height: 4.5rem;
  max-height: 9rem;
  overflow-y: auto;
  margin: 0 1rem 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}
.subtitle-bar p {
  margin: 0;
  font-family: var(--font-body);
  font-size: 1.05rem;
  line-height: 1.5;
}
.subtitle-warning {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.75rem !important;
  line-height: 1.4 !important;
  color: var(--coral-ink);
}
.capture-zone {
  flex: 1;
  margin: 0 1rem;
  border-radius: 28px;
  border: none;
  background: var(--coral);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  cursor: pointer;
  color: var(--on-coral);
}
.capture-label {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  padding: 0 1rem;
}
.capture-count {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.85rem;
}
footer {
  padding: 1rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
.progress {
  height: 5px;
  background: var(--line);
  border-radius: 3px;
  margin-bottom: 0.75rem;
}
.progress-fill {
  height: 100%;
  background: var(--coral);
  border-radius: 3px;
}
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}
.play-pause {
  font-size: 1.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink);
}
.time {
  font-family: var(--font-body);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
  min-width: 3ch;
}
.checkpoint-overlay {
  position: fixed;
  inset: 0;
  background: var(--ink);
  color: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
}
.checkpoint-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  padding: 0 2rem;
}
.checkpoint-actions button {
  padding: 1.25rem;
  border-radius: 999px;
  border: 2px solid var(--bg);
  background: none;
  color: var(--bg);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.1rem;
  cursor: pointer;
  width: 100%;
}
</style>
