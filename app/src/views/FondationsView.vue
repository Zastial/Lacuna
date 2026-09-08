<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LANGS, useSettingsStore } from '../stores/settings'
import { useFondationsStore } from '../stores/fondations'
import { correctFeedback, tapFeedback, wrongFeedback } from '../services/feedback'
import type { ConjugItem } from '../types/models'

const emit = defineEmits<{ back: [] }>()
const settings = useSettingsStore()
const fondations = useFondationsStore()

const answered = ref(false)
const chosen = ref('')

onMounted(async () => {
  if (!settings.loaded) await settings.load()
  await fondations.setLang(settings.primaryLang)
})

const choices = computed(() => LANGS.filter((l) => settings.langs.includes(l.id)))
const isCorrect = computed(() => chosen.value === fondations.currentItem?.answer)

function clearAnswer(): void {
  answered.value = false
  chosen.value = ''
}

async function onLang(id: string): Promise<void> {
  void tapFeedback()
  await fondations.setLang(id)
}

function start(): void {
  void tapFeedback()
  fondations.startLesson()
}

async function review(): Promise<void> {
  void tapFeedback()
  await fondations.startReview()
}

function beginPractice(): void {
  void tapFeedback()
  clearAnswer()
  fondations.beginPractice()
}

async function choose(item: ConjugItem, option: string): Promise<void> {
  if (answered.value) return
  answered.value = true
  chosen.value = option
  const ok = option === item.answer
  void (ok ? correctFeedback() : wrongFeedback())
  await fondations.answer(item, ok)
}

function next(): void {
  void tapFeedback()
  clearAnswer()
  fondations.next()
}

function retry(): void {
  void tapFeedback()
  clearAnswer()
  fondations.retryWrong()
}

async function finish(): Promise<void> {
  void tapFeedback()
  clearAnswer()
  await fondations.endSession()
}
</script>

<template>
  <div class="fondations">
    <header>
      <button class="back" @click="fondations.session ? finish() : emit('back')">←</button>
      <p class="wordmark">Fondations</p>
    </header>

    <!-- ACCUEIL : ce qu'on apprend, où on en est, ce qui reste. -->
    <div v-if="!fondations.session" class="body">
      <div v-if="choices.length > 1" class="seg">
        <button
          v-for="l in choices"
          :key="l.id"
          :class="{ active: fondations.lang === l.id }"
          @click="onLang(l.id)"
        >
          {{ l.flag }} {{ l.label }}
        </button>
      </div>

      <p v-if="fondations.loading" class="loading">Chargement…</p>

      <template v-else>
        <div class="progress-card glass">
          <p class="label">Ton parcours</p>
          <p class="progress-num">
            {{ fondations.doneCount }} <span>/ {{ fondations.lessons.length }} leçons</span>
          </p>
          <div class="bar">
            <div
              class="fill"
              :style="{
                width: `${(fondations.doneCount / Math.max(1, fondations.lessons.length)) * 100}%`,
              }"
            />
          </div>
          <p class="hint">
            Chaque leçon présente les six formes d'un verbe, puis les fait
            pratiquer. Ce que tu rates revient plus souvent.
          </p>
        </div>

        <template v-if="fondations.currentLesson">
          <p class="label section-label">Leçon suivante</p>
          <button class="lesson-btn glass" @click="start">
            <span class="lesson-verb">{{ fondations.currentLesson.verb.lemma }}</span>
            <span class="lesson-meta">
              {{ fondations.currentLesson.verb.fr }} · {{ fondations.currentLesson.tenseLabel }}
            </span>
            <span class="lesson-forms">6 formes à découvrir puis pratiquer</span>
          </button>
        </template>
        <p v-else class="hint">Tout le parcours est terminé. Les révisions continuent.</p>

        <p class="label section-label">Révisions</p>
        <button v-if="fondations.dueCount > 0" class="review-btn" @click="review">
          Réviser {{ fondations.dueCount }} forme{{ fondations.dueCount > 1 ? 's' : '' }}
        </button>
        <p v-else class="hint">
          Rien à réviser pour l'instant — reviens plus tard, ou avance dans le parcours.
        </p>
      </template>
    </div>

    <!-- DÉCOUVRIR : on montre avant de demander. -->
    <div v-else-if="fondations.session.phase === 'discover'" class="body">
      <p class="label">On découvre</p>
      <h2>
        {{ fondations.session.lesson?.verb.lemma }}
        <span class="h2-fr">{{ fondations.session.lesson?.verb.fr }}</span>
      </h2>
      <p class="tense">{{ fondations.session.lesson?.tenseLabel }}</p>

      <ul class="forms">
        <li v-for="f in fondations.session.lesson?.forms" :key="f.itemId">
          <span class="pronoun">{{ f.pronoun }}</span>
          <span class="form">{{ f.form }}</span>
        </li>
      </ul>
    </div>

    <!-- PRATIQUER : exactement les formes qu'on vient de voir. -->
    <div v-else-if="fondations.session.phase === 'practice' && fondations.currentItem" class="body">
      <p class="label">
        {{ fondations.session.kind === 'review' ? 'Révision' : 'À toi' }}
        · {{ fondations.session.step + 1 }}/{{ fondations.session.items.length }}
      </p>
      <p class="verb-label">
        {{ fondations.currentItem.verb }}
        <template v-if="fondations.currentItem.hint"> — {{ fondations.currentItem.hint }}</template>
        · {{ fondations.currentItem.tense }}
      </p>
      <p class="prompt">{{ fondations.currentItem.prompt }}</p>

      <div class="options">
        <button
          v-for="o in fondations.currentItem.options"
          :key="o"
          class="option"
          :class="{
            correct: answered && o === fondations.currentItem.answer,
            wrong: answered && o === chosen && !isCorrect,
          }"
          :disabled="answered"
          @click="choose(fondations.currentItem, o)"
        >
          {{ o }}
        </button>
      </div>

      <template v-if="answered">
        <p class="feedback" :class="isCorrect ? 'ok' : 'ko'">
          {{ isCorrect ? 'Exact.' : `La bonne réponse était « ${fondations.currentItem.answer} ».` }}
        </p>
        <p class="solution">
          {{ fondations.currentItem.prompt.replace('___', fondations.currentItem.answer) }}
        </p>
        <p v-if="fondations.currentItem.promptFr" class="prompt-fr">
          {{ fondations.currentItem.promptFr }}
        </p>
      </template>
    </div>

    <!-- BILAN : ce qui est acquis, ce qui revient. -->
    <div v-else class="body">
      <p class="label">Bilan</p>
      <h2 v-if="fondations.session.wrong.length === 0">Tout est juste.</h2>
      <h2 v-else>
        {{ fondations.session.wrong.length }}
        forme{{ fondations.session.wrong.length > 1 ? 's' : '' }} à retravailler
      </h2>
      <p class="hint">
        Ce que tu as manqué reviendra plus tôt que le reste — c'est la
        répétition espacée qui décide du moment.
      </p>
    </div>

    <div v-if="fondations.session" class="controls">
      <button v-if="fondations.session.phase === 'discover'" class="primary" @click="beginPractice">
        J'ai compris — pratiquer
      </button>

      <button
        v-else-if="fondations.session.phase === 'practice'"
        class="primary"
        :disabled="!answered"
        @click="next"
      >
        Suivant
      </button>

      <template v-else>
        <button v-if="fondations.session.wrong.length > 0" class="secondary" @click="retry">
          Refaire les ratées
        </button>
        <button class="primary" @click="finish">Terminer</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.fondations {
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
  color: var(--teal-ink);
}
.body {
  flex: 1;
  padding: 0.5rem 1.25rem 1.25rem;
  overflow-y: auto;
}
.seg {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.seg button {
  flex: 1;
  padding: 0.7rem;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
  font-weight: 500;
  cursor: pointer;
}
.seg button.active {
  border-color: transparent;
  background: var(--teal);
  color: var(--on-teal);
  font-weight: 700;
}
.progress-card {
  padding: 1.1rem 1.25rem;
  margin-bottom: 1.5rem;
}
.progress-num {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 2rem;
  margin: 0.3rem 0 0.6rem;
  color: var(--teal-ink);
}
.progress-num span {
  font-size: 1rem;
  color: var(--ink-soft);
}
.bar {
  height: 6px;
  border-radius: 3px;
  background: var(--line);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--teal);
  transition: width 0.4s ease;
}
.section-label {
  margin: 1.5rem 0 0.6rem;
}
.lesson-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 1.1rem 1.25rem;
  text-align: left;
  cursor: pointer;
  color: var(--ink);
}
.lesson-verb {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--teal-ink);
}
.lesson-meta {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.lesson-forms {
  font-size: 0.8rem;
  color: var(--ink-faint);
}
.review-btn {
  width: 100%;
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
h2 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.9rem;
  margin: 0.2rem 0;
}
.h2-fr {
  font-size: 1rem;
  font-weight: 500;
  color: var(--ink-soft);
  margin-left: 0.5rem;
}
.tense {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin: 0 0 1.25rem;
}
.forms {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.forms li {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.85rem 1.1rem;
  border-radius: 16px;
  background: var(--teal-wash);
}
.pronoun {
  min-width: 4.5rem;
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.form {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--teal-ink);
}
.verb-label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin: 0.4rem 0 0.5rem;
}
.prompt {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0 0 1.25rem;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.option {
  width: 100%;
  padding: 1rem 1.15rem;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 1.1rem;
  text-align: left;
  cursor: pointer;
}
.option.correct {
  border-color: transparent;
  background: var(--teal);
  color: var(--on-teal);
  font-weight: 700;
}
.option.wrong {
  border-color: transparent;
  background: var(--coral-wash);
  color: var(--coral-ink);
}
.feedback {
  font-family: var(--font-display);
  font-weight: 700;
  margin: 1rem 0 0;
}
.feedback.ok {
  color: var(--teal-ink);
}
.feedback.ko {
  color: var(--coral-ink);
}
.solution {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
  margin: 0.75rem 0 0.2rem;
}
.prompt-fr {
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-style: italic;
  color: var(--ink-soft);
  margin: 0;
}
.hint {
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0.6rem 0 0;
}
.controls {
  flex: none;
  display: flex;
  gap: 0.6rem;
  padding: 1rem 1.25rem calc(1rem + env(safe-area-inset-bottom));
}
.controls button {
  flex: 1;
  padding: 1.05rem;
  border-radius: 999px;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
}
.controls .primary {
  background: var(--teal);
  color: var(--on-teal);
}
.controls .secondary {
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
}
.controls button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
