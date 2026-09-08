<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFondationsStore } from '../stores/fondations'
import { completionFeedback, correctFeedback, wrongFeedback } from '../services/feedback'
import type { ConjugItem, ScenarioMCQOption } from '../types/models'

const emit = defineEmits<{ back: [] }>()
const fondations = useFondationsStore()

fondations.init()

const answered = ref(false)
const isCorrect = ref(false)
const feedbackHint = ref('')

watch(
  () => fondations.session?.stepIndex,
  () => {
    answered.value = false
    feedbackHint.value = ''
  },
)

function onHeaderBack(): void {
  if (!fondations.session) {
    emit('back')
    return
  }
  if (fondations.session.stepIndex > 0) fondations.back()
  else void fondations.exitSession()
}

function selectMcqOption(option: ScenarioMCQOption, hint: string): void {
  if (answered.value) return
  answered.value = true
  isCorrect.value = option.correct
  feedbackHint.value = option.correct ? '' : hint
  void (option.correct ? correctFeedback() : wrongFeedback())
}

async function selectConjugOption(item: ConjugItem, choice: string): Promise<void> {
  if (answered.value) return
  answered.value = true
  isCorrect.value = choice === item.answer
  void (isCorrect.value ? correctFeedback() : wrongFeedback())
  await fondations.gradeConjugItem(item, isCorrect.value)
}

function onNext(): void {
  fondations.next()
  const step = fondations.currentStep
  if (step?.kind === 'done' || step?.kind === 'drillDone') void completionFeedback()
}

async function onFinish(): Promise<void> {
  await fondations.next()
  await fondations.exitSession()
}
</script>

<template>
  <div class="fondations">
    <header>
      <button class="back" @click="onHeaderBack">←</button>
      <p class="wordmark">Fondations</p>
    </header>

    <div v-if="!fondations.session" class="picker">
      <div class="lang-switch">
        <button class="gold" :class="{ active: fondations.lang === 'it' }" @click="fondations.setLang('it')">Italiano</button>
        <button class="plum" :class="{ active: fondations.lang === 'es' }" @click="fondations.setLang('es')">Español</button>
      </div>

      <template v-if="Object.keys(fondations.verbMastery).length > 0">
        <p class="label section-label">Tes verbes</p>
        <div class="mastery-row">
          <span v-for="(tier, verb) in fondations.verbMastery" :key="verb" class="verb-chip" :class="tier">
            {{ verb }}
          </span>
        </div>
      </template>

      <button class="drill-btn" @click="fondations.startQuickDrill()">
        Entraînement rapide — sans son
        <span v-if="fondations.dueDrillCount > 0" class="drill-badge">{{ fondations.dueDrillCount }}</span>
      </button>

      <p class="label section-label">Scénarios</p>
      <ul class="scenario-list">
        <li v-for="s in fondations.scenarios" :key="s.id">
          <button class="glass scenario-btn" @click="fondations.startScenario(s.id)">
            <span>{{ s.title }}</span>
            <span v-if="fondations.completedIds.has(s.id)" class="check-badge">✓</span>
          </button>
        </li>
      </ul>
    </div>

    <div v-else class="session">
      <div class="dots">
        <div
          v-for="(_, i) in fondations.session.steps"
          :key="i"
          class="dot"
          :class="{ filled: i <= fondations.session!.stepIndex }"
        />
      </div>

      <div class="step-body" v-if="fondations.currentStep">
        <template v-if="fondations.currentStep.kind === 'dialogue'">
          <h2>{{ fondations.currentStep.scenario.title }}</h2>
          <button class="sub-toggle" @click="fondations.toggleSubtitleLang()">
            Sous-titres : {{ fondations.subtitleLang === 'fr' ? 'français' : (fondations.lang === 'it' ? 'italien' : 'espagnol') }}
          </button>
          <div class="dialogue-lines">
            <div v-for="(l, i) in fondations.currentStep.scenario.dialogue" :key="i" class="line">
              <p class="speaker">{{ l.speaker }}</p>
              <p class="line-text">{{ fondations.subtitleLang === 'fr' ? l.fr : l.target }}</p>
            </div>
          </div>
          <div class="vocab-chips">
            <span v-for="(v, i) in fondations.currentStep.scenario.vocab" :key="i" class="chip">
              <strong>{{ v.target }}</strong> — {{ v.fr }}
            </span>
          </div>
        </template>

        <template v-else-if="fondations.currentStep.kind === 'mcq'">
          <h2>Mise en situation</h2>
          <p class="prompt">{{ fondations.currentStep.mcq.prompt }}</p>
          <p v-if="answered" class="prompt-fr">{{ fondations.currentStep.mcq.fr }}</p>
          <div class="options">
            <button
              v-for="(o, i) in fondations.currentStep.mcq.options"
              :key="i"
              class="option"
              :class="{ correct: answered && o.correct, wrong: answered && !o.correct }"
              :disabled="answered"
              @click="selectMcqOption(o, fondations.currentStep.kind === 'mcq' ? fondations.currentStep.mcq.hint : '')"
            >
              {{ o.target }}
              <!-- La traduction s'affiche sur TOUTES les options, pas
                   seulement la bonne : comprendre pourquoi les autres étaient
                   fausses est la moitié de l'exercice. -->
              <span v-if="answered" class="option-fr">{{ o.fr }}</span>
            </button>
          </div>
          <p v-if="answered" class="feedback" :class="{ ok: isCorrect, ko: !isCorrect }">
            {{ isCorrect ? 'Exact.' : feedbackHint }}
          </p>
        </template>

        <template v-else-if="fondations.currentStep.kind === 'conjug'">
          <h2>Entraînement mêlé</h2>
          <p class="verb-label">
            {{ fondations.currentStep.item.verb }}
            <template v-if="fondations.currentStep.item.hint"> — {{ fondations.currentStep.item.hint }}</template>
            · {{ fondations.currentStep.item.tense }}
          </p>
          <p class="prompt">{{ fondations.currentStep.item.prompt }}</p>
          <div class="options">
            <button
              v-for="o in fondations.currentStep.item.options"
              :key="o"
              class="option"
              :class="{ correct: answered && o === fondations.currentStep.item.answer, wrong: answered && o !== fondations.currentStep.item.answer }"
              :disabled="answered"
              @click="selectConjugOption(fondations.currentStep.item, o)"
            >
              {{ o }}
            </button>
          </div>
          <template v-if="answered">
            <p class="feedback" :class="{ ok: isCorrect, ko: !isCorrect }">
              {{ isCorrect ? 'Exact.' : `La bonne réponse était « ${fondations.currentStep.item.answer} ».` }}
            </p>
            <!-- Phrase reconstituée avec le blanc rempli : c'est elle qu'on
                 veut mémoriser, pas l'énoncé troué. -->
            <p class="solution">
              {{ fondations.currentStep.item.prompt.replace('___', fondations.currentStep.item.answer) }}
            </p>
            <p v-if="fondations.currentStep.item.promptFr" class="prompt-fr">
              {{ fondations.currentStep.item.promptFr }}
            </p>
          </template>
        </template>

        <template v-else-if="fondations.currentStep.kind === 'done'">
          <div class="done-panel">
            <div class="big-badge celebrate">✓</div>
            <p class="done-label">Terminé</p>
            <p class="hint">Les formes verbales rejoignent ta révision espacée.</p>
          </div>
        </template>

        <template v-else-if="fondations.currentStep.kind === 'drillDone'">
          <div class="done-panel">
            <div class="big-badge celebrate">✓</div>
            <p class="done-label">Terminé</p>
            <p class="hint">{{ fondations.currentStep.count }} carte{{ fondations.currentStep.count > 1 ? 's' : '' }} révisée{{ fondations.currentStep.count > 1 ? 's' : '' }}.</p>
          </div>
        </template>
      </div>

      <div class="nav">
        <button
          v-if="fondations.currentStep?.kind === 'done' || fondations.currentStep?.kind === 'drillDone'"
          class="next primary"
          @click="onFinish"
        >
          Retour aux scénarios
        </button>
        <button v-else class="next primary" :disabled="fondations.currentStep?.kind !== 'dialogue' && !answered" @click="onNext">
          Suivant
        </button>
      </div>
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
.wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.4rem;
  margin: 0;
  color: var(--teal-ink);
}
.picker {
  flex: 1;
  padding: 0 1rem 1rem;
  overflow-y: auto;
}
.section-label {
  margin: 1.25rem 0 0.6rem;
}
.lang-switch {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
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
.mastery-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.verb-chip {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--glass);
  border: 1px solid var(--line);
  color: var(--ink-soft);
}
.verb-chip.bronze {
  background: var(--coral-wash);
  color: var(--coral-ink);
}
.verb-chip.silver {
  background: var(--glass-strong);
  color: var(--ink);
}
.verb-chip.gold {
  background: var(--gold-wash);
  color: var(--gold-ink);
}
.drill-btn {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  margin-top: 1.25rem;
  border-radius: 16px;
  border: none;
  background: var(--teal-wash);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  color: var(--teal-ink);
}
.drill-badge {
  min-width: 1.4rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--teal);
  color: var(--on-teal);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.8rem;
  line-height: 1.4rem;
}
.scenario-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.scenario-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  padding: 0.9rem 1.1rem;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 1rem;
  color: var(--ink);
  cursor: pointer;
}
.session {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 1.25rem;
  overflow-y: auto;
}
.dots {
  display: flex;
  gap: 6px;
  margin-bottom: 1rem;
}
.dot {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--line);
}
.dot.filled {
  background: var(--teal);
}
.step-body {
  flex: 1;
}
h2 {
  font-family: var(--font-display);
  font-weight: 700;
  margin: 0 0 0.75rem;
  font-size: 1.15rem;
  color: var(--ink);
}
.sub-toggle {
  display: block;
  margin-left: auto;
  margin-bottom: 0.75rem;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  color: var(--ink-soft);
}
.dialogue-lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.line {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 0.65rem 0.9rem;
}
.speaker {
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-faint);
  margin: 0 0 2px;
}
.line-text {
  font-family: var(--font-body);
  margin: 0;
  font-size: 1rem;
}
.vocab-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.chip {
  background: var(--coral-wash);
  color: var(--coral-ink);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.85rem;
}
.prompt {
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 1.05rem;
  margin: 0 0 1rem;
}
.prompt-fr {
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-style: italic;
  color: var(--ink-soft);
  margin: -0.6rem 0 1rem;
}
.solution {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
  margin: 0.75rem 0 0.2rem;
}
.option-fr {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  font-style: italic;
  opacity: 0.75;
}
.verb-label {
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-faint);
  margin: 0 0 0.5rem;
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
.feedback {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
}
.feedback.ok {
  color: var(--teal-ink);
}
.feedback.ko {
  color: var(--coral-ink);
}
.done-panel {
  text-align: center;
  padding: 2rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.hint {
  color: var(--ink-soft);
  font-size: 0.9rem;
}
.nav {
  padding: 1rem 0 calc(1rem + env(safe-area-inset-bottom));
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
  background: var(--teal);
  color: var(--on-teal);
}
.next:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
