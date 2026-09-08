// Contrôle qualité des tables de conjugaison : compare chaque forme produite
// par services/conjugator.ts aux données UniMorph, là où UniMorph en a.
//
// UniMorph ne sert PAS de source (il omet le présent irrégulier des verbes
// courants, cf. le commentaire en tête de conjugator.ts) mais de vérificateur :
// tout ce qu'il contient et qui contredit notre table est un bug chez nous.
//
// Usage : node --experimental-strip-types tools/verify-conjugations.mjs <ita.tsv> <spa.tsv>

import { readFileSync } from 'node:fs'
import { conjugate, PERSONS } from '../app/src/services/conjugator.ts'
import { IT_VERBS } from '../app/src/data/verbs/it.ts'
import { ES_VERBS } from '../app/src/data/verbs/es.ts'

const TENSE_TAGS = {
  present: 'IND;PRS',
  imperfect: 'IND;PST',
  future: 'IND;FUT',
}
const PERSON_TAGS = {
  '1sg': '1;SG', '2sg': '2;SG', '3sg': '3;SG',
  '1pl': '1;PL', '2pl': '2;PL', '3pl': '3;PL',
}

function loadUniMorph(path) {
  const map = new Map()
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [lemma, form, features] = line.split('\t')
    if (!lemma || !features?.startsWith('V;')) continue
    // Ignorer les formes à clitiques (espagnol) : "dámelo" n'est pas une
    // forme de conjugaison simple.
    if (features.includes('PRO')) continue
    const key = `${lemma}|${features}`
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(form)
  }
  return map
}

function candidateKeys(lemma, tense, person) {
  const t = TENSE_TAGS[tense]
  const p = PERSON_TAGS[person]
  const base = [`${lemma}|V;${t};${p}`]
  if (tense === 'imperfect') base.push(`${lemma}|V;${t};${p};IPFV`)
  // L'espagnol distingue tú (INFM) et usted (FORM) à la 2e personne.
  if (person === '2sg' || person === '2pl') base.push(`${lemma}|V;${t};${p};INFM`)
  return base
}

function verify(lang, verbs, unimorph) {
  let checked = 0
  const mismatches = []
  const uncovered = []

  for (const verb of verbs) {
    for (const tense of Object.keys(TENSE_TAGS)) {
      const forms = conjugate(lang, verb, tense)
      if (!forms) {
        uncovered.push(`${verb.lemma} (${tense}) : non conjugable`)
        continue
      }
      PERSONS.forEach((person, i) => {
        const known = candidateKeys(verb.lemma, tense, person)
          .flatMap((k) => [...(unimorph.get(k) ?? [])])
        if (known.length === 0) return
        checked++
        if (!known.includes(forms[i])) {
          mismatches.push(`${lang} ${verb.lemma} ${tense} ${person} : nous="${forms[i]}" unimorph=${known.join('/')}`)
        }
      })
    }
  }
  return { checked, mismatches, uncovered }
}

const [itaPath, spaPath] = process.argv.slice(2)
const results = [
  ['it', verify('it', IT_VERBS, loadUniMorph(itaPath))],
  ['es', verify('es', ES_VERBS, loadUniMorph(spaPath))],
]

let failed = false
for (const [lang, r] of results) {
  console.log(`\n=== ${lang.toUpperCase()} : ${r.checked} formes confrontées à UniMorph ===`)
  if (r.uncovered.length) console.log(`non conjugables : ${r.uncovered.length}\n  ${r.uncovered.join('\n  ')}`)
  if (r.mismatches.length) {
    failed = true
    console.log(`ÉCARTS (${r.mismatches.length}) :\n  ${r.mismatches.join('\n  ')}`)
  } else {
    console.log('aucun écart')
  }
}
process.exit(failed ? 1 : 0)
