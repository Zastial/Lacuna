// Miroir des types renvoyés par l'API backend (voir internal/apihttp côté Go)
// et des tables locales SQLite (§6.2 du plan).

export interface ApiFeed {
  id: number
  rss_url: string
  title: string
  lang: string
  level: string
  has_transcripts: boolean
}

export interface ApiEpisode {
  id: number
  feed_id: number
  title: string
  audio_url: string
  duration_s: number | null
  published_at: string | null
  segments_ready: boolean
}

export interface ApiSegment {
  idx: number
  start_ms: number
  end_ms: number
  text: string
  word_count: number
  rare_ratio: number | null
}

export interface ApiEpisodeSegments {
  episode: ApiEpisode
  segments: ApiSegment[]
}

// Épisode téléchargé localement (table `episode` miroir + chemin fichier local).
//
// audioRelativePath est un chemin RELATIF (ex: "episodes/episode-9.mp3"),
// résolu en URI absolue à la lecture via Filesystem.getUri(). L'UUID du
// conteneur sandbox iOS peut changer entre deux lancements (réinstallation
// via Xcode, restauration...) — un chemin absolu persisté en base casserait
// tous les épisodes déjà téléchargés après le redéploiement hebdomadaire
// prévu par le plan (§3.1).
export interface LocalEpisode {
  id: number
  feedId: number
  title: string
  audioRelativePath: string
  durationS: number | null
}

export interface LocalSegment {
  id: number
  episodeId: number
  idx: number
  startMs: number
  endMs: number
  text: string
}

export type CaptureKind = 'not_understood' | 'unknown_word' | 'liked'

export interface Capture {
  id: string
  segmentId: number
  episodeId: number
  capturedAt: number
  kind: CaptureKind
  note: string | null
  synced: boolean
}
