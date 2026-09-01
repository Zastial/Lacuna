import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

// EpisodePlayer encapsule un <audio> natif + l'API Web MediaSession, qui
// donne les contrôles d'écran de verrouillage (§7 : "utilisable à l'aveugle,
// téléphone en poche") sans plugin Capacitor tiers — WKWebView supporte
// nativement navigator.mediaSession depuis iOS 15. La lecture en
// arrière-plan elle-même dépend de la config native (UIBackgroundModes
// "audio" + AVAudioSession .playback, voir ios/App/App/AppDelegate.swift).
export class EpisodePlayer {
  private audio: HTMLAudioElement

  // relativePath (ex: "episodes/episode-9.mp3") est résolu ici en URI
  // absolue puis converti pour WKWebView — jamais persisté résolu (§ voir
  // LocalEpisode.audioRelativePath : l'UUID du conteneur sandbox peut
  // changer entre deux installations).
  static async create(relativePath: string, title: string): Promise<EpisodePlayer> {
    const { uri } = await Filesystem.getUri({ path: relativePath, directory: Directory.Data })
    return new EpisodePlayer(Capacitor.convertFileSrc(uri), title)
  }

  private constructor(resolvedSrc: string, title: string) {
    this.audio = new Audio(resolvedSrc)
    this.audio.preload = 'auto'
    this.audio.addEventListener('error', () => {
      const code = this.audio.error?.code
      const codeNames: Record<number, string> = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' }
      console.error(`audio error: code=${code} (${code ? codeNames[code] : '?'}) src=${resolvedSrc}`)
    })
    this.setupMediaSession(title)
  }

  private setupMediaSession(title: string): void {
    if (!('mediaSession' in navigator)) return

    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Lacuna' })
    } catch (err) {
      console.warn('MediaMetadata not supported:', err)
    }
    this.setActionHandler('play', () => this.play())
    this.setActionHandler('pause', () => this.pause())
    this.setActionHandler('seekbackward', (details) => this.seekBy(-(details.seekOffset ?? 15)))
    this.setActionHandler('seekforward', (details) => this.seekBy(details.seekOffset ?? 15))
  }

  // Certaines actions MediaSession ne sont pas supportées par toutes les
  // versions de WKWebView : l'échec sur une action ne doit jamais empêcher
  // la lecture elle-même.
  private setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler): void {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch (err) {
      console.warn(`MediaSession action "${action}" not supported:`, err)
    }
  }

  play(): void {
    this.audio.play().catch((err: unknown) => {
      console.error('audio.play() rejected:', err, 'src=', this.audio.currentSrc)
    })
    this.setPlaybackState('playing')
  }

  pause(): void {
    this.audio.pause()
    this.setPlaybackState('paused')
  }

  private setPlaybackState(state: MediaSessionPlaybackState): void {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.playbackState = state
    } catch (err) {
      console.warn('MediaSession playbackState not supported:', err)
    }
  }

  seekBy(deltaSeconds: number): void {
    this.audio.currentTime = Math.max(0, this.audio.currentTime + deltaSeconds)
  }

  get paused(): boolean {
    return this.audio.paused
  }

  get currentTimeMs(): number {
    return this.audio.currentTime * 1000
  }

  set currentTimeMs(ms: number) {
    this.audio.currentTime = ms / 1000
  }

  get durationMs(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : 0
  }

  onTimeUpdate(cb: (ms: number) => void): void {
    this.audio.addEventListener('timeupdate', () => cb(this.currentTimeMs))
  }

  onEnded(cb: () => void): void {
    this.audio.addEventListener('ended', cb)
  }

  destroy(): void {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
  }
}
