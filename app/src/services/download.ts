import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'

import { getEpisodeSegments } from '../api/client'
import { saveEpisode, saveSegments } from '../db/repository'
import type { ApiEpisode, LocalEpisode, LocalSegment } from '../types/models'

// downloadEpisode télécharge l'audio (Filesystem, hors ligne ensuite) et les
// segments alignés (SQLite) — §8 Phase 2 : "audio -> Filesystem, segments ->
// SQLite". Le MP3 est récupéré directement depuis l'hébergeur d'origine
// (§5 : le backend ne proxifie jamais l'audio), le reste vient de l'API.
export async function downloadEpisode(
  episode: ApiEpisode,
  feed: { lang: string; level: string },
  onProgress?: (ratio: number) => void,
): Promise<LocalEpisode> {
  await Filesystem.mkdir({ path: 'episodes', directory: Directory.Data, recursive: true }).catch(() => {
    // dossier déjà existant : pas une erreur
  })

  const fileName = `episode-${episode.id}.mp3`
  const relativePath = `episodes/${fileName}`
  const { uri } = await Filesystem.getUri({ path: relativePath, directory: Directory.Data })

  let removeListener: (() => void) | undefined
  if (onProgress) {
    const handle = await FileTransfer.addListener('progress', (status) => {
      if (status.url !== episode.audio_url) return
      if (status.lengthComputable && status.contentLength > 0) {
        onProgress(status.bytes / status.contentLength)
      }
    })
    removeListener = () => {
      handle.remove()
    }
  }

  try {
    await FileTransfer.downloadFile({ url: episode.audio_url, path: uri, progress: Boolean(onProgress) })
  } finally {
    removeListener?.()
  }

  const { episode: fresh, segments } = await getEpisodeSegments(episode.id)

  const localEpisode: LocalEpisode = {
    id: fresh.id,
    feedId: fresh.feed_id,
    title: fresh.title,
    audioRelativePath: relativePath,
    durationS: fresh.duration_s,
    lang: feed.lang,
    level: feed.level,
  }
  await saveEpisode(localEpisode)

  const localSegments: LocalSegment[] = segments.map((s) => ({
    id: 0,
    episodeId: fresh.id,
    idx: s.idx,
    startMs: s.start_ms,
    endMs: s.end_ms,
    text: s.text,
  }))
  await saveSegments(fresh.id, localSegments)

  return localEpisode
}
