<script setup lang="ts">
// La mascotte : une bulle de parole à qui il manque un morceau — la lacune
// du nom. C'est le trou qui fait le personnage, et c'est ce que l'app
// comble. Dessinée en SVG plutôt qu'en image : nette à toutes les tailles,
// et les couleurs suivent les tokens du thème sans second fichier sombre.
withDefaults(defineProps<{ size?: number }>(), { size: 44 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    role="img"
    aria-label="Lacuna"
    class="mark"
  >
    <defs>
      <!-- L'encoche est retirée du corps par un masque plutôt que dessinée
           par-dessus : sur fond clair comme sur fond sombre, le trou laisse
           voir la page au lieu d'y peindre une couleur qui jurerait. -->
      <mask id="lacuna-bite">
        <rect x="0" y="0" width="100" height="100" fill="#fff" />
        <circle cx="92" cy="40" r="17" fill="#000" />
      </mask>
    </defs>

    <g mask="url(#lacuna-bite)">
      <path
        class="body"
        d="M22 12 h48 a20 20 0 0 1 20 20 v24 a20 20 0 0 1 -20 20 h-22 l-18 15 v-15 h-8 a20 20 0 0 1 -20 -20 v-24 a20 20 0 0 1 20 -20 z"
      />
    </g>

    <circle class="eye" cx="36" cy="42" r="6" />
    <circle class="eye" cx="60" cy="42" r="6" />
    <path class="smile" d="M35 58 q13 11 26 0" fill="none" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.mark {
  display: block;
  flex: none;
}
.body {
  fill: var(--teal);
}
.eye {
  fill: var(--on-teal);
}
.smile {
  stroke: var(--on-teal);
  stroke-width: 5;
}
</style>
