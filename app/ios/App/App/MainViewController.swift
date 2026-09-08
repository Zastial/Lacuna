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

    /// Fond aux couleurs de l'app sous la WebView.
    ///
    /// Entre l'écran de lancement natif et la première peinture du HTML, on
    /// voyait une frame blanche — mesurée à (253,253,253) sur une capture en
    /// rafale, encadrée par du noir puis par le fond de l'app. La WebView
    /// est blanche par défaut, et ce blanc traverse l'écran de chargement
    /// qu'il était censé masquer.
    ///
    /// La couleur est dynamique plutôt que fixe : un fond clair figé
    /// clignoterait sur un téléphone en thème sombre.
    override func viewDidLoad() {
        super.viewDidLoad()

        let background = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 0.051, green: 0.102, blue: 0.086, alpha: 1) // --bg sombre
                : UIColor(red: 0.918, green: 0.965, blue: 0.941, alpha: 1) // --bg clair
        }
        view.backgroundColor = background
        webView?.backgroundColor = background
        webView?.isOpaque = false
        webView?.scrollView.backgroundColor = background
    }
}
