<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORIES, LANGS, useSettingsStore } from '../stores/settings'
import LacunaMark from '../components/LacunaMark.vue'
import { tapFeedback } from '../services/feedback'

const emit = defineEmits<{ done: [] }>()
const settings = useSettingsStore()

const step = ref(0)
const LAST_STEP = 2

// Rien n'est pré-coché : le choix doit être explicite. En contrepartie on
// ne laisse pas continuer sans au moins une langue et un centre d'intérêt,
// sinon l'accueil serait vide au tout premier lancement.
const canContinue = computed(() => {
  if (step.value === 1) return settings.langs.length > 0
  if (step.value === 2) return settings.categories.length > 0
  return true
})

async function onLang(lang: string): Promise<void> {
  void tapFeedback()
  await settings.toggleLang(lang)
}

async function onCategory(id: string): Promise<void> {
  void tapFeedback()
  await settings.toggleCategory(id)
}

async function next(): Promise<void> {
  void tapFeedback()
  if (step.value < LAST_STEP) {
    step.value += 1
    return
  }
  await settings.completeOnboarding()
  emit('done')
}
</script>

<template>
  <div class="onboarding">
    <div class="dots">
      <span v-for="i in LAST_STEP + 1" :key="i" :class="{ on: i - 1 <= step }" />
    </div>

    <div class="body">
      <template v-if="step === 0">
        <LacunaMark :size="92" class="hero" />
        <p class="kicker">Bienvenue</p>
        <h1>Lacuna</h1>
        <p class="lead">
          Apprendre une langue avec ce que tu regardes déjà : des vidéos
          récentes, dans tes centres d'intérêt, et des exercices qui
          reviennent au bon moment.
        </p>
      </template>

      <template v-else-if="step === 1">
        <p class="kicker">Étape 1</p>
        <h1>Quelles langues ?</h1>
        <p class="lead">
          Les deux si tu veux — vidéos, articles et notifications piocheront
          alors dans l'une et l'autre.
        </p>
        <div class="choices">
          <button
            v-for="l in LANGS"
            :key="l.id"
            class="choice big"
            :class="{ on: settings.langs.includes(l.id) }"
            @click="onLang(l.id)"
          >
            <span class="flag">{{ l.flag }}</span>
            <span>{{ l.label }}</span>
          </button>
        </div>
      </template>

      <template v-else>
        <p class="kicker">Étape 2</p>
        <h1>Qu'est-ce qui t'intéresse ?</h1>
        <p class="lead">
          On te proposera des vidéos et des temps forts récents sur ces
          sujets, dans les langues choisies.
        </p>
        <div class="choices">
          <button
            v-for="c in CATEGORIES"
            :key="c.id"
            class="choice"
            :class="{ on: settings.categories.includes(c.id) }"
            @click="onCategory(c.id)"
          >
            <span class="flag">{{ c.icon }}</span>
            <span>{{ c.label }}</span>
          </button>
        </div>
      </template>
    </div>

    <button class="cta" :disabled="!canContinue" @click="next">
      {{ step === LAST_STEP ? 'Commencer' : 'Continuer' }}
    </button>
  </div>
</template>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom));
  padding-top: calc(1.5rem + env(safe-area-inset-top));
  background: var(--bg);
  color: var(--ink);
}
.dots {
  display: flex;
  gap: 6px;
  margin-bottom: 2rem;
}
.dots span {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--line);
  transition: background 0.25s ease;
}
.dots span.on {
  background: var(--teal);
}
.body {
  flex: 1;
  overflow-y: auto;
}
.hero {
  margin-bottom: 1.5rem;
}
.kicker {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin: 0 0 0.4rem;
}
h1 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 2rem;
  line-height: 1.15;
  margin: 0 0 0.75rem;
  color: var(--teal-ink);
}
.lead {
  font-size: 1rem;
  line-height: 1.55;
  color: var(--ink-soft);
  margin: 0 0 1.75rem;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.choice {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 1rem 1.15rem;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 1.05rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.choice.big {
  padding: 1.25rem 1.15rem;
  font-size: 1.15rem;
}
.choice.on {
  border-color: transparent;
  background: var(--teal);
  color: var(--on-teal);
  font-weight: 700;
}
.flag {
  font-size: 1.4rem;
  line-height: 1;
}
.cta {
  flex: none;
  margin-top: 1.25rem;
  padding: 1.05rem;
  border-radius: 999px;
  border: none;
  background: var(--teal);
  color: var(--on-teal);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
}
.cta:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
