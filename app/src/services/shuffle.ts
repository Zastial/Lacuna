// Mélange de Fisher-Yates, sans muter le tableau source : les listes
// d'options viennent des fichiers de contenu importés (data/fondations,
// data/cultureg) et sont partagées entre toutes les sessions — les mélanger
// en place réordonnerait le contenu d'origine pour tout le reste de l'app.
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
