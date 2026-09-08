<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRevueStore } from '../stores/revue'
import { completionFeedback, correctFeedback, wrongFeedback } from '../services/feedback'
import type { ClozeToken } from '../services/frequency'

const emit = defineEmits<{ back: [] }>()
const revue = useRevueStore()

onMounted(() => {
  revue.start()
})

onUnmounted(() => {
  revue.player?.destroy()
})

const clozeTokens = computed<ClozeToken[]>(() => {
  const item = revue.current
  return item ? revue.cloze(item) : []
})

async function onGrade(grade: 'again' | 'good'): Promise<void> {
  void (grade === 'good' ? correctFeedback() : wrongFeedback())
  await revue.grade(grade)
  if (revue.done) void completionFeedback()
}

function tokenDisplay(t: ClozeToken): string {
  if (!t.masked || revue.revealed) return t.text
  // Blanc de longueur approximative : assez d'indice pour situer le mot
  // dans la phrase sans le révéler (§7 : cloze déterministe).
  return '▁'.repeat(Math.max(2, t.text.length))
}
</script>

<template>
  <div class="revue">
    <header>
      <button class="back" @click="emit('back')">←</button>
      <p class="wordmark">Réviser</p>
      <p class="label" v-if="revue.queue.length">{{ revue.remaining }} restant{{ revue.remaining > 1 ? 's' : '' }}</p>
    </header>

    <div v-if="revue.loading" class="center">Chargement…</div>

    <div v-else-if="revue.done" class="center">
      <div class="big-badge celebrate">✓</div>
      <p class="done-label">Terminé</p>
      <p class="hint">Reviens plus tard, ou capture de nouveaux passages en écoutant.</p>
    </div>

    <div v-else-if="revue.current" class="review-card">
      <p class="context prev" v-if="revue.prev">{{ revue.prev.text }}</p>

      <p class="cloze">
        <span v-for="(t, i) in clozeTokens" :key="i" :class="{ masked: t.masked && !revue.revealed }">{{ tokenDisplay(t) }}</span>
      </p>

      <p class="context next" v-if="revue.next">{{ revue.next.text }}</p>

      <div class="actions">
        <button class="replay" @click="revue.playCurrentSegment()" :disabled="revue.isPlaying">
          {{ revue.isPlaying ? '▶ lecture…' : '↺ Réécouter' }}
        </button>

        <button v-if="!revue.revealed" class="reveal" @click="revue.reveal()">Révéler</button>

        <div v-else class="grade-actions">
          <button class="grade again" @click="onGrade('again')">raté</button>
          <button class="grade good" @click="onGrade('good')">su !</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.revue {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  color: var(--ink);
}
header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  padding-top: calc(0.75rem + env(safe-area-inset-top));
}
header .label {
  margin-left: auto;
}
.back {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--ink);
}
.wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.4rem;
  margin: 0;
  color: var(--coral-ink);
}
.label {
  margin: 0;
}
.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  text-align: center;
}
.hint {
  color: var(--ink-soft);
  font-size: 0.95rem;
}
.review-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem 1.25rem;
  gap: 1rem;
  overflow-y: auto;
}
.context {
  color: var(--ink-faint);
  font-family: var(--font-body);
  font-size: 0.9rem;
  margin: 0;
}
.cloze {
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 1.4rem;
  line-height: 1.6;
  margin: 0.5rem 0;
}
.cloze span.masked {
  background: var(--coral-wash);
  color: var(--coral-ink);
  border-radius: 6px;
  padding: 0 0.15rem;
  letter-spacing: 0.02em;
}
.actions {
  margin-top: auto;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.replay {
  padding: 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}
.replay:disabled {
  opacity: 0.5;
}
.reveal {
  padding: 1rem;
  border-radius: 999px;
  border: none;
  background: var(--coral);
  color: var(--on-coral);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
}
.grade-actions {
  display: flex;
  gap: 0.75rem;
}
.grade {
  flex: 1;
  padding: 1rem;
  border-radius: 999px;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
}
.grade.again {
  background: var(--coral-wash);
  color: var(--coral-ink);
}
.grade.good {
  background: var(--teal);
  color: var(--on-teal);
}
</style>
