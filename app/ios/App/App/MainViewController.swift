import Capacitor
import UIKit

/// Enregistre les plugins natifs écrits dans le target de l'app.
///
/// Capacitor 8 ne découvre PAS les plugins en balayant le runtime Objective-C.
/// Il lit `packageClassList` dans capacitor.config.json, une liste que
/// `npx cap sync` construit à partir des paquets npm installés. Un plugin qui
/// vit dans le projet Xcode plutôt que dans un paquet n'y figure donc jamais,
/// et `registerPlugin` côté JavaScript renvoie un proxy dont chaque appel
/// échoue — silencieusement si l'appelant attrape l'erreur.
///
/// `registerPluginType` ne sert à rien ici : il retourne immédiatement quand
/// l'enregistrement automatique est actif, ce qui est le cas par défaut.
/// `registerPluginInstance` n'a pas cette garde, c'est le point d'accroche.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LacunaLinksPlugin())
        bridge?.registerPluginInstance(LacunaTranslatePlugin())
    }
}
