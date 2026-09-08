<script setup lang="ts">
import { dismissToast, ERROR_MESSAGE, ERROR_TEXT, runRetry, toast } from '../services/toast'
</script>

<template>
  <Transition name="toast">
    <!-- role="alert" : la bannière apparaît sans que l'utilisateur l'ait
         demandée, un lecteur d'écran doit l'annoncer immédiatement. -->
    <div v-if="toast.visible" class="toast" role="alert">
      <span class="msg">{{ toast.retry ? ERROR_TEXT : ERROR_MESSAGE }}</span>
      <button v-if="toast.retry" class="retry" @click="runRetry">Réessayer</button>
      <button class="close" aria-label="Fermer" @click="dismissToast">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 1rem;
  right: 1rem;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--coral-wash);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  color: var(--coral-ink);
}
.msg {
  flex: 1;
  font-size: 0.95rem;
  line-height: 1.3;
}
.retry {
  flex: none;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  border: none;
  background: var(--coral);
  color: var(--on-coral);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}
.close {
  flex: none;
  background: none;
  border: none;
  color: inherit;
  font-size: 0.9rem;
  opacity: 0.7;
  cursor: pointer;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.75rem);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
