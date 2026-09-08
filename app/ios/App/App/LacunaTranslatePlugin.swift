import Capacitor
import Foundation
import NaturalLanguage
import SwiftUI
import Translation

/// Traduction et détection de langue **sur l'appareil**, via les frameworks
/// système. Aucun service distant, aucune clé d'API, rien qui sorte du
/// téléphone — c'est ce qui rend la traduction des titres compatible avec le
/// choix « sans IA distante » du projet.
///
/// Contrainte structurante : `TranslationSession` ne s'obtient que par le
/// modificateur SwiftUI `.translationTask`. Il n'existe pas d'API purement
/// impérative. On monte donc une vue SwiftUI invisible dans la fenêtre le
/// temps d'une traduction (cf. `TranslationBridge`), puis on la retire.
@objc(LacunaTranslatePlugin)
public class LacunaTranslatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LacunaTranslatePlugin"
    public let jsName = "LacunaTranslate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "detect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise)
    ]

    // MARK: - Détection

    /// Détection hors ligne via NaturalLanguage, disponible depuis iOS 12 :
    /// c'est elle qui répond à « la source est-elle dans ma langue ? ».
    @objc func detect(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), !text.isEmpty else {
            call.reject("text is required")
            return
        }

        let recognizer = NLLanguageRecognizer()
        recognizer.processString(text)

        guard let language = recognizer.dominantLanguage else {
            call.resolve(["lang": NSNull(), "confidence": 0])
            return
        }
        let confidence = recognizer.languageHypotheses(withMaximum: 1)[language] ?? 0
        call.resolve(["lang": language.rawValue, "confidence": confidence])
    }

    // MARK: - Traduction

    @objc func availability(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else {
            call.resolve(["status": "unsupported", "reason": "ios-too-old"])
            return
        }
        guard let source = call.getString("source"), let target = call.getString("target") else {
            call.reject("source and target are required")
            return
        }

        Task {
            let status = await LanguageAvailability().status(
                from: Locale.Language(identifier: source),
                to: Locale.Language(identifier: target)
            )
            switch status {
            case .installed: call.resolve(["status": "installed"])
            case .supported: call.resolve(["status": "supported"])
            case .unsupported: call.resolve(["status": "unsupported", "reason": "pair-unavailable"])
            @unknown default: call.resolve(["status": "unsupported", "reason": "unknown"])
            }
        }
    }

    /// Déclenche le téléchargement du modèle. iOS affiche sa propre demande
    /// de confirmation : on ne peut pas la court-circuiter, et c'est très bien
    /// ainsi — c'est un téléchargement, l'utilisateur doit le décider.
    @objc func prepare(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else {
            call.reject("requires iOS 18")
            return
        }
        guard let source = call.getString("source"), let target = call.getString("target") else {
            call.reject("source and target are required")
            return
        }

        Task { @MainActor in
            do {
                try await TranslationBridge.shared.withSession(source: source, target: target) { session in
                    try await session.prepareTranslation()
                }
                call.resolve(["prepared": true])
            } catch {
                call.reject("prepare failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func translate(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else {
            call.reject("requires iOS 18")
            return
        }
        guard let text = call.getString("text"),
              let source = call.getString("source"),
              let target = call.getString("target") else {
            call.reject("text, source and target are required")
            return
        }

        Task { @MainActor in
            do {
                let translated = try await TranslationBridge.shared.withSession(source: source, target: target) { session in
                    try await session.translate(text).targetText
                }
                call.resolve(["text": translated])
            } catch {
                call.reject("translate failed: \(error.localizedDescription)")
            }
        }
    }
}

// MARK: - Pont SwiftUI

/// `TranslationBridge` fournit une `TranslationSession` à du code impératif.
///
/// `.translationTask` est un modificateur de vue : la session n'existe que
/// pendant qu'une vue est montée. On monte donc une vue de taille nulle,
/// masquée aux interactions, dans la fenêtre active ; dès que SwiftUI livre
/// la session, on exécute le travail demandé, puis on démonte la vue.
@available(iOS 18.0, *)
@MainActor
final class TranslationBridge {
    static let shared = TranslationBridge()

    enum BridgeError: Error, LocalizedError {
        case noWindow
        case sessionUnavailable

        var errorDescription: String? {
            switch self {
            case .noWindow: return "no active window to host the translation session"
            case .sessionUnavailable: return "the system did not provide a translation session"
            }
        }
    }

    func withSession<T>(
        source: String,
        target: String,
        _ body: @escaping (TranslationSession) async throws -> T
    ) async throws -> T {
        guard let window = Self.activeWindow() else { throw BridgeError.noWindow }

        let configuration = TranslationSession.Configuration(
            source: Locale.Language(identifier: source),
            target: Locale.Language(identifier: target)
        )

        // Une seule reprise : SwiftUI peut réexécuter la tâche (changement de
        // configuration, recomposition). Reprendre deux fois une continuation
        // fait planter le process, on garde donc la garde explicite.
        var resumed = false
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<T, Error>) in
            var host: UIHostingController<TranslationHostView>?

            let finish: (Result<T, Error>) -> Void = { result in
                guard !resumed else { return }
                resumed = true
                host?.view.removeFromSuperview()
                host?.removeFromParent()
                host = nil
                continuation.resume(with: result)
            }

            let view = TranslationHostView(configuration: configuration) { session in
                do {
                    finish(.success(try await body(session)))
                } catch {
                    finish(.failure(error))
                }
            }

            let controller = UIHostingController(rootView: view)
            controller.view.frame = .zero
            controller.view.isUserInteractionEnabled = false
            controller.view.isHidden = true
            window.addSubview(controller.view)
            host = controller
        }
    }

    private static func activeWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
    }
}

@available(iOS 18.0, *)
private struct TranslationHostView: View {
    let configuration: TranslationSession.Configuration
    let run: (TranslationSession) async -> Void

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .translationTask(configuration) { session in
                await run(session)
            }
    }
}
