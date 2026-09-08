// Mesure des chaînes YouTube candidates, pour choisir sur des chiffres plutôt
// qu'au jugé. Le flux Atom public expose media:statistics (vues) et
// media:starRating (likes) par vidéo — sans clé d'API.
//
// La médiane plutôt que la moyenne : une seule vidéo virale suffirait à faire
// passer pour populaire une chaîne qui ne l'est pas. La médiane décrit ce que
// la chaîne fait habituellement.
//
// Usage : node tools/rank-channels.mjs handle1 handle2 ...

const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
const UA_FEED = 'Lacuna-Ingester/0.1'

async function resolveChannelId(handle) {
  const res = await fetch(`https://www.youtube.com/@${handle}`, { headers: { 'User-Agent': UA_BROWSER } })
  if (!res.ok) return null
  const html = await res.text()
  return html.match(/externalId":"(UC[A-Za-z0-9_-]{22})/)?.[1] ?? null
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

async function measure(handle) {
  const id = await resolveChannelId(handle)
  if (!id) return { handle, error: 'handle introuvable' }

  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, {
    headers: { 'User-Agent': UA_FEED },
  })
  const xml = await res.text()
  const entries = xml.split('<entry>').slice(1)
  if (entries.length === 0) return { handle, id, error: 'flux vide' }

  const views = []
  const likes = []
  for (const entry of entries) {
    const v = entry.match(/<media:statistics views="(\d+)"/)?.[1]
    const l = entry.match(/<media:starRating count="(\d+)"/)?.[1]
    if (v) views.push(Number(v))
    if (l) likes.push(Number(l))
  }

  // Date de la plus récente vidéo : une chaîne inactive n'alimentera jamais
  // un fil « à regarder », quelle que soit sa popularité passée.
  //
  // Lue DANS la première entrée : le <published> de tête appartient au flux
  // lui-même et vaut la date de création de la chaîne, ce qui donnait des
  // « dernière vidéo il y a 7204 jours » pour une chaîne active.
  const latest = entries[0].match(/<published>([^<]+)</)?.[1] ?? null
  const daysSince = latest ? Math.round((Date.now() - Date.parse(latest)) / 86400000) : null

  return {
    handle,
    id,
    videos: entries.length,
    medianViews: median(views),
    medianLikes: median(likes),
    daysSinceLatest: daysSince,
  }
}

const handles = process.argv.slice(2)
const results = []
for (const h of handles) {
  results.push(await measure(h).catch((e) => ({ handle: h, error: String(e) })))
}

results.sort((a, b) => (b.medianViews ?? -1) - (a.medianViews ?? -1))
for (const r of results) {
  if (r.error) {
    console.log(`${r.handle.padEnd(24)} ✗ ${r.error}`)
    continue
  }
  console.log(
    `${r.handle.padEnd(24)} vues~${String(r.medianViews).padStart(8)}  likes~${String(r.medianLikes).padStart(6)}` +
      `  ${String(r.videos).padStart(2)} vidéos  dernière il y a ${r.daysSinceLatest}j  ${r.id}`,
  )
}
