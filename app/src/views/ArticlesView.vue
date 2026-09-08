<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Browser } from '@capacitor/browser'
import { useArticlesStore } from '../stores/articles'
import { useSettingsStore } from '../stores/settings'
import { buildCloze } from '../services/frequency'
import type { ApiArticle } from '../types/models'

const emit = defineEmits<{ back: [] }>()
const articles = useArticlesStore()
const settings = useSettingsStore()

onMounted(() => {
  void articles.fetch()
})

function onHeaderBack(): void {
  if (articles.current) {
    articles.close()
    return
  }
  emit('back')
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Le cloze masque les mots hors liste de fréquence : en français, la langue
// de l'utilisateur, il n'y a ni liste ni intérêt pédagogique — tout serait
// masqué. On rend donc le résumé tel quel pour les articles L'Équipe.
const summaryTokens = computed(() => {
  const a = articles.current
  if (!a || a.lang === 'fr') return []
  return buildCloze(a.summary, a.lang, 'native')
})

async function openFull(article: ApiArticle): Promise<void> {
  await Browser.open({ url: article.url })
}
</script>

<template>
  <div class="articles">
    <header>
      <button class="back" @click="onHeaderBack">←</button>
      <p class="wordmark">Articles</p>
    </header>

    <div v-if="!articles.current" class="picker">
      <div class="lang-switch">
        <button class="gold" :class="{ active: articles.lang === 'it' }" @click="articles.setLang('it')">Italiano</button>
        <button class="plum" :class="{ active: articles.lang === 'es' }" @click="articles.setLang('es')">Español</button>
        <button class="teal" :class="{ active: articles.lang === 'fr' }" @click="articles.setLang('fr')">Sport</button>
      </div>

      <p v-if="articles.lang === 'fr'" class="sport-note">
        L'Équipe, filtré sur tes sports. Tu connais déjà le sens : l'exercice
        est de le redire en {{ settings.targetLang === 'es' ? 'espagnol' : 'italien' }}.
      </p>

      <p v-if="articles.loading" class="hint">Chargement…</p>
      <p v-else-if="articles.error" class="error">{{ articles.error }}</p>
      <p v-else-if="articles.articles.length === 0" class="hint">Aucun article pour l'instant.</p>

      <ul>
        <li v-for="a in articles.articles" :key="a.id">
          <button class="glass article-btn" @click="articles.open(a)">
            <span class="source-row">
              <span class="source">{{ a.source_name }}</span>
              <span class="date">{{ formatDate(a.published_at) }}</span>
            </span>
            <span class="title">{{ a.title }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div v-else class="reader">
      <span class="source-row">
        <span class="source">{{ articles.current.source_name }}</span>
        <span class="date">{{ formatDate(articles.current.published_at) }}</span>
      </span>
      <h2>{{ articles.current.title }}</h2>
      <p v-if="articles.current.lang === 'fr'" class="summary">{{ articles.current.summary }}</p>
      <p v-else class="summary">
        <span v-for="(t, i) in summaryTokens" :key="i" :class="{ rare: t.masked }">{{ t.text }}</span>
      </p>
      <!-- L'Équipe ne fournit pas de description sur tous ses items (les
           sujets abonnés sortent sans résumé) : sans texte à extraire, la
           mention « Extrait » n'a plus de sens. -->
      <p v-if="articles.current.summary" class="excerpt-note">
        Extrait — l'article complet est sur le site source.
      </p>
      <button class="read-full" @click="openFull(articles.current)">Lire l'article complet ↗</button>
    </div>
  </div>
</template>

<style scoped>
.articles {
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
  color: var(--plum-ink);
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
.lang-switch button.teal.active {
  border-color: transparent;
  background: var(--teal);
  color: var(--on-teal);
  font-weight: 700;
}
.sport-note {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: -0.75rem 0 1.25rem;
}
.hint {
  color: var(--ink-soft);
}
.error {
  color: var(--coral-ink);
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.article-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  text-align: left;
  padding: 0.9rem 1.1rem;
  cursor: pointer;
  color: var(--ink);
}
.source-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.title {
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 1.05rem;
  line-height: 1.4;
}
.reader {
  flex: 1;
  padding: 0.5rem 1.25rem 1.25rem;
  overflow-y: auto;
}
.reader h2 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.4rem;
  line-height: 1.4;
  margin: 0.5rem 0 1rem;
  color: var(--ink);
}
.summary {
  font-family: var(--font-body);
  font-size: 1.1rem;
  line-height: 1.7;
  margin: 0 0 1rem;
}
.summary span.rare {
  background: var(--plum-wash);
  color: var(--plum-ink);
  border-radius: 6px;
}
.excerpt-note {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--ink-faint);
  margin: 0 0 1.5rem;
}
.read-full {
  width: 100%;
  padding: 1rem;
  border-radius: 999px;
  border: none;
  background: var(--plum);
  color: var(--on-plum);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
}
</style>
