import AVFoundation
import Capacitor
import Foundation
import Speech

/// Reconnaissance vocale pour l'entraînement à l'oral.
///
/// C'est la brique qui manquait le plus : jusqu'ici l'app ne demandait que de
/// reconnaître une réponse parmi trois, jamais de produire une phrase. Or on
/// n'apprend pas à parler en cochant des cases, et le contexte d'usage visé —
/// marcher, transports, sport — exclut de toute façon l'écran et le clavier.
///
/// `supportsOnDeviceRecognition` dépend de la langue installée sur l'appareil
/// (dictée/clavier). Quand elle l'est, tout reste hors ligne ; sinon iOS passe
/// par ses serveurs, ce qui suppose du réseau. On expose l'information plutôt
/// que de la masquer, pour que l'app puisse le dire à l'utilisateur.
@objc(LacunaSpeechPlugin)
public class LacunaSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LacunaSpeechPlugin"
    public let jsName = "LacunaSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var lastTranscript = ""

    // MARK: - Disponibilité

    @objc func availability(_ call: CAPPluginCall) {
        guard let lang = call.getString("lang") else {
            call.reject("lang is required")
            return
        }
        let locale = Locale(identifier: localeIdentifier(for: lang))

        guard SFSpeechRecognizer.supportedLocales().contains(locale),
              let recognizer = SFSpeechRecognizer(locale: locale) else {
            call.resolve(["supported": false, "onDevice": false])
            return
        }
        call.resolve([
            "supported": true,
            "onDevice": recognizer.supportsOnDeviceRecognition,
        ])
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            guard speechStatus == .authorized else {
                call.resolve(["granted": false, "reason": "speech-denied"])
                return
            }
            // Deux autorisations distinctes, et les deux sont nécessaires :
            // transcrire suppose d'abord de pouvoir écouter.
            //
            // La cible du projet est iOS 15 : AVAudioApplication n'existe qu'à
            // partir d'iOS 17, d'où les deux chemins.
            let resolve: (Bool) -> Void = { micGranted in
                call.resolve([
                    "granted": micGranted,
                    "reason": micGranted ? "" : "mic-denied",
                ])
            }
            if #available(iOS 17.0, *) {
                AVAudioApplication.requestRecordPermission(completionHandler: resolve)
            } else {
                AVAudioSession.sharedInstance().requestRecordPermission(resolve)
            }
        }
    }

    // MARK: - Dictée

    @objc func start(_ call: CAPPluginCall) {
        guard let lang = call.getString("lang") else {
            call.reject("lang is required")
            return
        }
        let locale = Locale(identifier: localeIdentifier(for: lang))
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            call.reject("recognizer unavailable for \(locale.identifier)")
            return
        }

        stopEngine()

        do {
            let session = AVAudioSession.sharedInstance()
            // .duckOthers plutôt que .mixWithOthers : si l'utilisateur écoute
            // une vidéo, on baisse le son au lieu de dicter par-dessus.
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            call.reject("audio session: \(error.localizedDescription)")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        // Hors ligne quand la langue est installée sur l'appareil. Sinon iOS
        // bascule sur ses serveurs — on ne force pas, sous peine d'échouer là
        // où une transcription réseau aurait marché.
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        self.request = request

        lastTranscript = ""

        let input = audioEngine.inputNode
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            stopEngine()
            call.reject("audio engine: \(error.localizedDescription)")
            return
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            if let result {
                self?.lastTranscript = result.bestTranscription.formattedString
                // Émis en continu : l'utilisateur voit ses mots apparaître,
                // ce qui rend l'attente supportable et le micro visiblement vivant.
                self?.notifyListeners("partial", data: [
                    "text": result.bestTranscription.formattedString,
                    "final": result.isFinal,
                ])
            }
            if error != nil || result?.isFinal == true {
                self?.stopEngine()
            }
        }

        call.resolve(["started": true, "onDevice": request.requiresOnDeviceRecognition])
    }

    @objc func stop(_ call: CAPPluginCall) {
        let text = stopEngine()
        call.resolve(["text": text])
    }

    /// Coupe le micro et rend la dernière transcription connue. Appelé aussi
    /// bien par l'utilisateur que par la fin de reconnaissance, d'où
    /// l'idempotence.
    @discardableResult
    private func stopEngine() -> String {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        request = nil
        task?.finish()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return lastTranscript
    }

    private func localeIdentifier(for lang: String) -> String {
        switch lang {
        case "it": return "it-IT"
        case "es": return "es-ES"
        default: return "fr-FR"
        }
    }
}
