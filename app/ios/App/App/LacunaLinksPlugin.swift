import Capacitor
import Foundation
import UIKit

/// Ouverture d'un lien **hors de l'app**, à la différence de @capacitor/browser
/// qui affiche un Safari intégré. C'est ce qui permet à iOS de router une URL
/// vers l'application qui la revendique — l'app YouTube pour un lien YouTube.
///
/// UIApplication.open rend un booléen de succès : c'est lui qui rend le repli
/// fiable. Sans ce retour, il faudrait deviner par un délai si l'app cible
/// existe, et se tromper une fois sur deux.
@objc(LacunaLinksPlugin)
public class LacunaLinksPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LacunaLinksPlugin"
    public let jsName = "LacunaLinks"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("url is required")
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                // Trace conservée : c'est le seul moyen de distinguer « l'app
                // cible est absente » d'un plugin non enregistré, les deux
                // aboutissant au même repli côté JavaScript.
                CAPLog.print("⚡️ LacunaLinks: open \(url.scheme ?? "?") -> \(opened)")
                call.resolve(["opened": opened])
            }
        }
    }
}
