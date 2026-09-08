<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { scenariosForLang } from '../data/fondations'
import { useSettingsStore } from '../stores/settings'
import { listen, matches, requestSpeechPermission, speechAvailability } from '../services/speech'
import { correctFeedback, tapFeedback, wrongFeedback } from '../services/feedback'
import { shuffle } from '../services/shuffle'
import { reportError } from '../services/toast'

const emit = defineEmits<{ back: [] }>()
const settings = useSettingsStore()

const lang = ref('it')
const status = ref<'checking' | 'unsupported' | 'denied' | 'ready'>('checking')
const onDevice = ref(false)

// Les répliques de dialogue sont le seul contenu strictement bilingue et
// prononçable dont on dispose : chaque ligne a sa version française et sa
// version cible. C'est exactement la matière d'un exercice de production.
const phrases = ref<{ target: string; fr: string }[]>([])
const index = ref(0)
const phrase = computed(() => phrases.value[index.value] ?? null)

const recording = ref(false)
const heard = ref('')
const verdict = ref<'none' | 'ok' | 'ko'>('none')
let stopListening: (() => Promise<string>) | null = null

onMounted(async () => {
  if (!settings.loaded) await settings.load()
  lang.value = settings.primaryLang
  phrases.value = shuffle(scenariosForLang(lang.value).flatMap((s) => s.dialogue))

  const avail = await speechAvailability(lang.value)
  if (!avail.supported) {
    status.value = 'unsupported'
    return
  }
  onDevice.value = avail.onDevice
  status.value = (await requestSpeechPermission()) ? 'ready' : 'denied'
})

// Le micro doit être relâché si l'écran est quitté en cours d'enregistrement,
// sinon la session audio reste ouverte et l'app garde la main sur le son.
onUnmounted(() => {
  void stopListening?.()
})

async function toggle(): Promise<void> {
  void tapFeedback()
  if (recording.value) {
    await finish()
    return
  }

  heard.value = ''
  verdict.value = 'none'
  recording.value = true
  try {
    stopListening = await listen(lang.value, (t) => (heard.value = t))
  } catch (err) {
    recording.value = false
    reportError(err, toggle)
  }
}

async function finish(): Promise<void> {
  const stop = stopListening
  stopListening = null
  recording.value = false
  if (!stop) return

  const finalText = (await stop()) || heard.value
  heard.value = finalText
  if (!phrase.value) return

  const ok = matches(finalText, phrase.value.target)
  verdict.value = ok ? 'ok' : 'ko'
  void (ok ? correctFeedback() : wrongFeedback())
}

function next(): void {
  void tapFeedback()
  heard.value = ''
  verdict.value = 'none'
  index.value = (index.value + 1) % Math.max(1, phrases.value.length)
}
</script>

<template>
  <div class="parler">
    <header>
      <button class="back" @click="emit('back')">←</button>
      <p class="wordmark">Parler</p>
    </header>

    <div class="body">
      <template v-if="status === 'checking'">
        <p class="hint">Vérification du micro…</p>
      </template>

      <template v-else-if="status === 'unsupported'">
        <p class="hint">
          La dictée n'est pas disponible pour cette langue sur cet appareil.
        </p>
      </template>

      <template v-else-if="status === 'denied'">
        <p class="hint">
          Il faut autoriser le micro et la reconnaissance vocale dans les
          réglages iOS pour t'entraîner à l'oral.
        </p>
      </template>

      <template v-else-if="phrase">
        <p class="label">Dis cette phrase</p>
        <p class="fr">{{ phrase.fr }}</p>

        <!-- La phrase cible ne s'affiche qu'après coup : la lire pendant
             qu'on parle transformerait la production en lecture à voix haute. -->
        <p v-if="verdict !== 'none'" class="target">{{ phrase.target }}</p>

        <p v-if="heard" class="heard" :class="verdict">« {{ heard }} »</p>

        <p v-if="verdict === 'ok'" class="feedback ok">Exact.</p>
        <p v-else-if="verdict === 'ko'" class="feedback ko">
          Pas tout à fait — réessaie, ou passe à la suivante.
        </p>

        <p v-if="!onDevice" class="note">
          La reconnaissance passe par le réseau : installe le clavier
          {{ lang === 'es' ? 'espagnol' : 'italien' }} dans iOS pour qu'elle
          fonctionne hors ligne.
        </p>
      </template>
    </div>

    <div v-if="status === 'ready'" class="controls">
      <button class="mic" :class="{ on: recording }" @click="toggle">
        {{ recording ? 'Arrêter' : '🎙 Parler' }}
      </button>
      <button class="next" @click="next">Suivante</button>
    </div>
  </div>
</template>

<style scoped>
.parler {
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
.body {
  flex: 1;
  padding: 1rem 1.25rem;
  overflow-y: auto;
}
.fr {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.6rem;
  line-height: 1.3;
  margin: 0.4rem 0 1rem;
}
.target {
  font-family: var(--font-body);
  font-size: 1.15rem;
  color: var(--teal-ink);
  margin: 0 0 1rem;
}
.heard {
  font-family: var(--font-body);
  font-style: italic;
  font-size: 1.05rem;
  color: var(--ink-soft);
  margin: 0 0 0.75rem;
}
.heard.ok {
  color: var(--teal-ink);
}
.heard.ko {
  color: var(--coral-ink);
}
.feedback {
  font-family: var(--font-display);
  font-weight: 700;
}
.feedback.ok {
  color: var(--teal-ink);
}
.feedback.ko {
  color: var(--coral-ink);
}
.hint,
.note {
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.5;
}
.note {
  margin-top: 1.5rem;
  font-size: 0.8rem;
  color: var(--ink-faint);
}
.controls {
  flex: none;
  display: flex;
  gap: 0.6rem;
  padding: 1rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
}
.mic {
  flex: 2;
  padding: 1.1rem;
  border-radius: 999px;
  border: none;
  background: var(--coral);
  color: var(--on-coral);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
}
.mic.on {
  background: var(--coral-ink);
  color: var(--bg);
}
.next {
  flex: 1;
  padding: 1.1rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: 700;
  cursor: pointer;
}
</style>
