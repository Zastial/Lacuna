<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import type { LocalEpisode } from '../types/models'

const props = defineProps<{ episode: LocalEpisode }>()
const emit = defineEmits<{ back: [] }>()

const player = usePlayerStore()

onMounted(async () => {
  await player.load(props.episode)
  player.play()
})

onUnmounted(() => {
  player.pause()
})

async function onCapture(): Promise<void> {
  // Vibration courte : accusé de réception tactile sans interrompre
  // l'écoute (utilisable les yeux fermés, téléphone en poche).
  if ('vibrate' in navigator) navigator.vibrate(40)
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
    </header>

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
}
.title {
  font-size: 0.95rem;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.capture-zone {
  flex: 1;
  margin: 0 1rem;
  border-radius: 1.5rem;
  border: none;
  background: #4444ee22;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  cursor: pointer;
}
.capture-label {
  font-size: 1.75rem;
  font-weight: 600;
  text-align: center;
  padding: 0 1rem;
}
.capture-count {
  opacity: 0.6;
  font-size: 1rem;
}
footer {
  padding: 1rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
.progress {
  height: 4px;
  background: #8884;
  border-radius: 2px;
  margin-bottom: 0.75rem;
}
.progress-fill {
  height: 100%;
  background: currentColor;
  border-radius: 2px;
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
}
.time {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
  min-width: 3ch;
}
.checkpoint-overlay {
  position: fixed;
  inset: 0;
  background: #000c;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
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
  border-radius: 0.75rem;
  border: 1px solid #fff6;
  background: #fff2;
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  width: 100%;
}
</style>
