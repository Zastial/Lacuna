import { registerPlugin } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

interface LacunaLinksPlugin {
  open(options: { url: string }): Promise<{ opened: boolean }>
}

const LacunaLinks = registerPlugin<LacunaLinksPlugin>('LacunaLinks')

// openYouTube envoie la vidéo à l'app YouTube plutôt qu'au Safari intégré.
//
// Le schéma youtube:// est réclamé par l'app officielle : iOS la lance
// directement, avec le compte connecté, le plein écran et les sous-titres.
// Le lien https, lui, tombe dans un navigateur qui affiche un mur de
// consentement Google et demande une connexion.
//
// UIApplication.open rend un booléen : c'est ce qui rend le repli fiable.
// Sans app YouTube installée, `opened` est faux et on ouvre le web — plutôt
// que de deviner par un délai, ce qui se tromperait une fois sur deux.
export async function openYouTube(videoId: string): Promise<void> {
  const webUrl = `https://www.youtube.com/watch?v=${videoId}`

  try {
    const { opened } = await LacunaLinks.open({ url: `youtube://www.youtube.com/watch?v=${videoId}` })
    if (opened) return
  } catch {
    // Plugin absent (web, ou build sans le natif) : on passe au repli.
  }

  await Browser.open({ url: webUrl })
}
