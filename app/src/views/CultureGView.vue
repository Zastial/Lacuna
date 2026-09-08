<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCultureGStore } from '../stores/cultureg'
import { completionFeedback, correctFeedback, wrongFeedback } from '../services/feedback'

const emit = defineEmits<{ back: [] }>()
const cultureg = useCultureGStore()

onMounted(() => {
  void cultureg.init()
})

const correctOptionTarget = computed(() => cultureg.current?.options.find((o) => o.correct)?.target ?? '')
const langTag = computed(() => (cultureg.lang === 'it' ? 'IT' : 'ES'))

async function onSelectOption(i: number): Promise<void> {
  await cultureg.answer(i)
  void (cultureg.lastCorrect ? correctFeedback() : wrongFeedback())
}

async function onNext(): Promise<void> {
  await cultureg.next()
  if (cultureg.done) void completionFeedback()
}

function onHeaderBack(): void {
  if (cultureg.queue.length > 0 && !cultureg.done) {
    cultureg.exit()
    return
  }
  emit('back')
}
</script>

<template>
  <div class="cultureg">
    <header>
      <button class="back" @click="onHeaderBack">←</button>
      <p class="wordmark">Culture G</p>
      <p class="label" v-if="cultureg.queue.length && !cultureg.done">{{ cultureg.remaining }} restante{{ cultureg.remaining > 1 ? 's' : '' }}</p>
    </header>

    <div v-if="cultureg.queue.length === 0 && !cultureg.done" class="picker">
      <div class="lang-switch">
        <button class="gold" :class="{ active: cultureg.lang === 'it' }" @click="cultureg.setLang('it')">Italiano</button>
        <button class="plum" :class="{ active: cultureg.lang === 'es' }" @click="cultureg.setLang('es')">Español</button>
      </div>

      <div class="score-card glass">
        <p class="label">Score</p>
        <p class="score">{{ cultureg.stats.correct }} / {{ cultureg.stats.total }}</p>
        <p class="score-hint">bonnes réponses</p>
      </div>

      <button v-if="cultureg.dueCount > 0" class="start-btn" @click="cultureg.start()">
        Commencer — {{ cultureg.dueCount }} question{{ cultureg.dueCount > 1 ? 's' : '' }}
      </button>
      <p v-else class="hint center-hint">Tout est à jour. Reviens plus tard pour de nouvelles questions.</p>
    </div>

    <div v-else-if="cultureg.done" class="center">
      <div class="big-badge celebrate">✓</div>
      <p class="done-label">Terminé</p>
      <p class="hint">{{ cultureg.stats.correct }} / {{ cultureg.stats.total }} bonnes réponses au total en {{ cultureg.lang === 'it' ? 'italien' : 'espagnol' }}.</p>
      <button class="start-btn" @click="cultureg.exit()">Retour</button>
    </div>

    <div v-else-if="cultureg.current" class="quiz">
      <p class="category">{{ cultureg.current.category }}</p>
      <p class="prompt">{{ cultureg.current.prompt }}</p>

      <div class="options">
        <button
          v-for="(o, i) in cultureg.current.options"
          :key="i"
          class="option"
          :class="{ correct: cultureg.answered && o.correct, wrong: cultureg.answered && !o.correct }"
          :disabled="cultureg.answered"
          @click="onSelectOption(i)"
        >
          {{ o.target }}
        </button>
      </div>

      <Transition name="pop">
      <div v-if="cultureg.answered" class="explanation">
        <p class="explanation-label">{{ cultureg.lastCorrect ? 'Exact.' : 'Pas tout à fait.' }}</p>

        <p class="translated-question">
          <span class="lang-tag">FR</span>{{ cultureg.current.promptFr }}
        </p>
        <p v-if="cultureg.current.answerFr" class="translated-answer">
          <span class="lang-tag">FR</span>{{ correctOptionTarget }} → {{ cultureg.current.answerFr }}
        </p>

        <p class="explanation-text">
          <span class="lang-tag">{{ langTag }}</span>{{ cultureg.current.explanationTarget }}
        </p>
        <p class="explanation-text">
          <span class="lang-tag">FR</span>{{ cultureg.current.explanation }}
        </p>
      </div>
      </Transition>

      <div class="nav">
        <button v-if="cultureg.answered" class="next primary" @click="onNext">Suivant</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cultureg {
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
  color: var(--gold-ink);
}
.picker {
  flex: 1;
  padding: 0 1.25rem 1.25rem;
  overflow-y: auto;
}
.lang-switch {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.lang-switch button {
  flex: 1;
  padding: 0.7rem;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
  font-weight: 500;
  cursor: pointer;
}
.lang-switch button.gold.active {
  border-color: transparent;
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.lang-switch button.plum.active {
  border-color: transparent;
  background: var(--plum);
  color: var(--on-plum);
  font-weight: 700;
}
.score-card {
  padding: 1.25rem;
  text-align: center;
  margin-bottom: 1.25rem;
}
.score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 2rem;
  margin: 0.25rem 0 0;
  color: var(--ink);
}
.score-hint {
  color: var(--ink-soft);
  font-size: 0.85rem;
  margin: 0;
}
.start-btn {
  width: 100%;
  padding: 1rem;
  border-radius: 999px;
  border: none;
  background: var(--gold);
  color: var(--on-gold);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
}
.center-hint {
  text-align: center;
  color: var(--ink-soft);
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
.center .start-btn {
  margin-top: 1rem;
}
.hint {
  color: var(--ink-soft);
  font-size: 0.95rem;
}
.quiz {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1.25rem 1.25rem;
  overflow-y: auto;
}
.category {
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
  margin: 0 0 0.5rem;
}
.prompt {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.3rem;
  line-height: 1.5;
  margin: 0 0 1.25rem;
  color: var(--ink);
}
.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.option {
  text-align: left;
  padding: 0.85rem 1.1rem;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--glass);
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 1rem;
  color: var(--ink);
  cursor: pointer;
}
.option.correct {
  border-color: transparent;
  background: var(--teal);
  color: var(--on-teal);
  font-weight: 600;
}
.option.wrong {
  border-color: transparent;
  background: var(--coral-wash);
  color: var(--coral-ink);
}
.option:disabled {
  cursor: default;
}
.explanation {
  margin-top: 1.25rem;
  padding: 1rem 1.1rem;
  border-radius: 18px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
}
.explanation-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  margin: 0 0 0.6rem;
}
.lang-tag {
  font-family: var(--font-body);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--ink-faint);
  background: var(--glass-strong);
  border-radius: 4px;
  padding: 1px 5px;
  margin-right: 0.5rem;
  vertical-align: 1px;
}
.translated-question,
.translated-answer {
  font-family: var(--font-body);
  font-style: italic;
  color: var(--ink-soft);
  line-height: 1.5;
  margin: 0 0 0.5rem;
}
.translated-answer {
  margin-bottom: 0.9rem;
}
.explanation-text {
  font-family: var(--font-body);
  line-height: 1.5;
  margin: 0 0 0.6rem;
  color: var(--ink);
}
.explanation-text:last-child {
  margin-bottom: 0;
}
.nav {
  margin-top: auto;
  padding-top: 1.25rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
.next {
  width: 100%;
  padding: 1rem;
  border-radius: 999px;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
}
.next.primary {
  background: var(--gold);
  color: var(--on-gold);
}
</style>
