import type { CapacitorConfig } from '@capacitor/cli'

// Bundle identifier fixé une fois pour toutes (§3.1 du plan) : ne jamais le
// changer, ça consomme le quota Apple de 10 App IDs / 7 jours en free
// provisioning.
const config: CapacitorConfig = {
  appId: 'com.zastial.lacuna',
  appName: 'Lacuna',
  webDir: 'dist',
}

export default config
