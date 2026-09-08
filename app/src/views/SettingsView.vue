<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { SPORTS, useSettingsStore } from '../stores/settings'
import { sendPreview, syncNotifications } from '../services/notifications'
import { prepareTranslation, translationStatus } from '../services/translate'
import { tapFeedback } from '../services/feedback'

const emit = defineEmits<{ back: [] }>()
const settings = useSettingsStore()

// État du moteur de traduction Apple pour la paire français → langue cible.
// 'installed' : prêt. 'supported' : le modèle existe mais reste à
// télécharger. 'unsupported' : indisponible ici (Simulateur, iOS < 18).
const mtStatus = ref<'installed' | 'supported' | 'unsupported' | 'checking'>('checking')

async function refreshMT(): Promise<void> {
  mtStatus.value = 'checking'
  mtStatus.value = await translationStatus(settings.targetLang)
}

onMounted(async () => {
  if (!settings.loaded) await settings.load()
  await refreshMT()
})

async function onDownloadModel(): Promise<void> {
  void tapFeedback()
  await prepareTranslation(settings.targetLang)
  await refreshMT()
  await apply()
}

// Chaque changement reprogramme les notifications : les réglages n'ont
// d'effet qu'une fois appliqués au planning, autant le faire tout de suite
// plutôt que d'attendre le prochain lancement.
async function apply(): Promise<void> {
  void tapFeedback()
  await syncNotifications(settings.$state)
}

async function onLang(lang: string): Promise<void> {
  await settings.setTargetLang(lang)
  // La disponibilité du modèle dépend de la paire : changer de langue
  // cible peut faire passer de « prêt » à « à télécharger ».
  await refreshMT()
  await apply()
}

async function onSport(id: string): Promise<void> {
  await settings.toggleSport(id)
  void tapFeedback()
}

async function onFlag(key: 'notifySport' | 'notifyPhrase' | 'notifyReview', value: boolean): Promise<void> {
  await settings.setFlag(key, value)
  await apply()
}

async function onHour(event: Event): Promise<void> {
  await settings.setHour(Number((event.target as HTMLInputElement).value))
  await apply()
}

const previewState = ref<'idle' | 'ok' | 'denied' | 'empty'>('idle')

async function onPreview(): Promise<void> {
  void tapFeedback()
  previewState.value = await sendPreview(settings.$state)
}
</script>

<template>
  <div class="settings">
    <header>
      <button class="back" @click="emit('back')">←</button>
      <p class="wordmark">Réglages</p>
    </header>

    <div class="body">
      <p class="label section-label">Langue des notifications</p>
      <div class="lang-switch">
        <button class="gold" :class="{ active: settings.targetLang === 'it' }" @click="onLang('it')">Italiano</button>
        <button class="plum" :class="{ active: settings.targetLang === 'es' }" @click="onLang('es')">Español</button>
      </div>

      <p class="label section-label">Tes sports</p>
      <p class="hint">Les titres L'Équipe proposés viendront de ces rubriques.</p>
      <div class="chips">
        <button
          v-for="s in SPORTS"
          :key="s.id"
          class="chip"
          :class="{ on: settings.sports.includes(s.id) }"
          @click="onSport(s.id)"
        >
          {{ s.label }}
        </button>
      </div>

      <p class="label section-label">Notifications</p>
      <label class="row glass">
        <span>Phrase du jour</span>
        <input type="checkbox" :checked="settings.notifyPhrase" @change="onFlag('notifyPhrase', ($event.target as HTMLInputElement).checked)" />
      </label>
      <label class="row glass">
        <span>Rappel de révision</span>
        <input type="checkbox" :checked="settings.notifyReview" @change="onFlag('notifyReview', ($event.target as HTMLInputElement).checked)" />
      </label>
      <label class="row glass" :class="{ disabled: mtStatus !== 'installed' }">
        <span>
          Titre sportif traduit
          <em v-if="mtStatus === 'checking'">vérification du moteur…</em>
          <em v-else-if="mtStatus === 'supported'">modèle de langue à télécharger</em>
          <em v-else-if="mtStatus === 'unsupported'">
            traduction hors ligne indisponible sur cet appareil
          </em>
        </span>
        <input
          type="checkbox"
          :disabled="mtStatus !== 'installed'"
          :checked="settings.notifySport && mtStatus === 'installed'"
          @change="onFlag('notifySport', ($event.target as HTMLInputElement).checked)"
        />
      </label>
      <button v-if="mtStatus === 'supported'" class="preview-btn" @click="onDownloadModel">
        Télécharger le modèle {{ settings.targetLang === 'es' ? 'espagnol' : 'italien' }}
      </button>

      <button class="preview-btn" @click="onPreview">Envoyer un aperçu</button>
      <p v-if="previewState === 'ok'" class="preview-note">
        Elle arrive dans quelques secondes — verrouille l'écran pour la voir.
      </p>
      <p v-else-if="previewState === 'denied'" class="preview-note warn">
        Les notifications sont refusées pour Lacuna dans les réglages iOS.
      </p>

      <p class="label section-label">Heure d'envoi</p>
      <div class="row glass">
        <span>{{ String(settings.notifyHour).padStart(2, '0') }} h 00</span>
        <input type="range" min="0" max="23" step="1" :value="settings.notifyHour" @change="onHour" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
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
}
.body {
  flex: 1;
  padding: 0 1.25rem 2rem;
  overflow-y: auto;
}
.section-label {
  margin: 1.5rem 0 0.6rem;
}
.hint {
  color: var(--ink-soft);
  font-size: 0.85rem;
  margin: 0 0 0.6rem;
}
.lang-switch {
  display: flex;
  gap: 0.5rem;
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
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink-soft);
  font-size: 0.9rem;
  cursor: pointer;
}
.chip.on {
  border-color: transparent;
  background: var(--teal);
  color: var(--on-teal);
  font-weight: 600;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  margin-bottom: 0.5rem;
}
.row.disabled {
  opacity: 0.55;
}
.row em {
  display: block;
  font-size: 0.75rem;
  font-style: normal;
  color: var(--ink-faint);
}
.preview-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--glass);
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: 700;
  cursor: pointer;
}
.preview-note {
  font-size: 0.8rem;
  color: var(--ink-soft);
  margin: 0.5rem 0 0;
}
.preview-note.warn {
  color: var(--coral-ink);
}
.row input[type='range'] {
  flex: 1;
  max-width: 60%;
  accent-color: var(--teal);
}
.row input[type='checkbox'] {
  width: 1.3rem;
  height: 1.3rem;
  accent-color: var(--teal);
}
</style>
