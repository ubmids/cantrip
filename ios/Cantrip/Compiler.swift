import Foundation
import FirebaseAILogic

/// Every model call in the iPhone app, through Firebase AI Logic.
///
/// - The compiler is Gemini in the cloud.
/// - Programs run on Apple's on-device Foundation Model
///   (`FirebaseAI.SystemLanguageModel.default`). Each check uses a fresh
///   session, because a session keeps history and every check must stand alone.
///
/// The prompts match `src/core/prompts.ts` so a cantrip behaves the same
/// way on both devices; the cloud then tunes it for this model.
@MainActor
final class Models: ObservableObject {
    static let compilerModel = "gemini-3.6-flash"
    let ai = FirebaseAI.firebaseAI(backend: .googleAI())

    var deviceAvailable: Bool { FirebaseAI.SystemLanguageModel.default.isAvailable }

    /// Apple's model needs an eligible iPhone with Apple Intelligence turned on and downloaded.
    var deviceProblem: String? {
        deviceAvailable ? nil : "Apple's on-device model isn't ready on this iPhone. Check that Apple Intelligence is on in Settings."
    }

    /// Cloud compiler call. Asks for JSON and parses it loosely.
    func cloudJSON(_ prompt: String) async throws -> [String: Any] {
        let model = ai.generativeModel(
            modelName: Self.compilerModel,
            generationConfig: GenerationConfig(temperature: 0.4, responseMIMEType: "application/json")
        )
        let response = try await model.generateContent(prompt)
        return try parseJSON(response.text ?? "")
    }

    /// On-device call only. Never falls back to the cloud: the text being checked stays on the phone.
    func deviceJSON(_ prompt: String) async throws -> (json: [String: Any], onDevice: Bool) {
        let session = ai.generativeModelSession(model: FirebaseAI.SystemLanguageModel.default)
        let response = try await session.respond(to: prompt)
        let onDevice = response.rawResponse.modelVersion.hasPrefix("apple-foundation-models")
        return (try parseJSON(response.content), onDevice)
    }
}

enum CompileError: LocalizedError {
    case noJSON, noProgram
    var errorDescription: String? {
        switch self {
        case .noJSON: return "The model didn't return JSON."
        case .noProgram: return "This cantrip has no program to start from."
        }
    }
}

func parseJSON(_ raw: String) throws -> [String: Any] {
    var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}"), start < end {
        text = String(text[start...end])
    }
    guard let data = text.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw CompileError.noJSON }
    return obj
}

func clip(_ s: String, _ max: Int = 3000) -> String {
    let flat = s.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    return flat.count <= max ? flat : String(flat.prefix(max - 1)) + "…"
}

func matchLabel(_ raw: String, _ labels: [String]) -> String? {
    let n = raw.lowercased().replacingOccurrences(of: "_", with: " ").replacingOccurrences(of: "-", with: " ")
        .trimmingCharacters(in: .whitespaces)
    return labels.first { $0.lowercased() == n }
}

// MARK: - Prompts (kept in step with src/core/prompts.ts)

enum Prompts {
    static let rules = """
    The program runs on a small on-device model with limited reasoning. Write for it:
    - Open with one sentence that states the job.
    - Then give a short numbered checklist of concrete signals to look for, with the label each signal points to.
    - Say what to do when signals conflict or none are present.
    - Use plain words. No nuance-heavy language, no long paragraphs.
    - Keep the system prompt under 180 words.
    - Examples must be realistic, varied, and short (under 80 words each). The evidence field is an exact quote from the example input, at most 12 words.
    """

    static func device(_ spec: Spec, _ p: Program, _ input: String) -> String {
        let examples = p.examples.map { e -> String in
            let answer = (try? String(data: JSONSerialization.data(withJSONObject: ["label": e.label, "reason": e.reason, "evidence": e.evidence], options: [.sortedKeys]), encoding: .utf8)) ?? "{}"
            return "Text: \"\"\"\(clip(e.input, 600))\"\"\"\nAnswer: \(answer)"
        }.joined(separator: "\n\n")
        return [
            p.systemPrompt,
            "Choose exactly one label: \(spec.labels.joined(separator: " | ")).",
            examples.isEmpty ? "" : "Examples:\n\n\(examples)",
            "Reply with a JSON object with keys label, reason (one short sentence) and evidence (exact words from the text, at most 12).",
            "Now answer for this text. Reply with JSON only.\nText: \"\"\"\(clip(input))\"\"\"\nAnswer:",
        ].filter { !$0.isEmpty }.joined(separator: "\n\n")
    }

    static func port(_ spec: Spec, _ p: Program) -> String {
        """
        You are the compiler for Cantrip. This program was tuned for Gemini Nano running inside Chrome. Adapt it for Apple's on-device Foundation Model, keeping its behaviour identical. Small models differ in what wording they follow reliably, so rewrite where that helps.

        Rule in the person's words: \"\"\"\(spec.intent)\"\"\"
        Labels: \(spec.labels.joined(separator: ", ")).

        System prompt:
        \"\"\"\(p.systemPrompt)\"\"\"

        Examples:
        \(p.examples.map { "- (\($0.label)) \(clip($0.input, 300))" }.joined(separator: "\n"))

        Return JSON with keys diagnosis (one line on what you changed), systemPrompt, and examples (2 to 5 objects with input, label, reason, evidence).

        \(rules)
        """
    }

    static func repair(_ spec: Spec, _ p: Program, _ tests: [TestCase], _ results: [TestResult]) -> String {
        let byId = Dictionary(uniqueKeysWithValues: tests.map { ($0.id, $0) })
        let failures = results.filter { !$0.ok }.enumerated().map { i, r in
            let t = byId[r.testId]
            return "\(i + 1). Text: \"\"\"\(clip(t?.input ?? "", 500))\"\"\"\n   Expected: \(r.expected). The device said: \(r.got ?? "(no valid answer)").\(t.map { "\n   Why the expected label is right: \($0.why)" } ?? "")"
        }.joined(separator: "\n")
        let passed = results.filter(\.ok).count
        return """
        You are the compiler for Cantrip. You wrote a program for Apple's on-device Foundation Model, ran it on the device, and it passed \(passed) of \(results.count) tests. Fix it.

        Rule in the person's words: \"\"\"\(spec.intent)\"\"\"
        Labels: \(spec.labels.joined(separator: ", ")). Flag labels: \(spec.flagLabels.joined(separator: ", ")).

        Current system prompt:
        \"\"\"\(p.systemPrompt)\"\"\"

        Failures on the device:
        \(failures)

        Diagnose why the small model failed, then rewrite the system prompt and examples so it gets these right without breaking the tests it already passes. Teach the general signal, not the specific test: never copy a failing test text into an example, and do not mention the tests.

        Return JSON with keys diagnosis, systemPrompt, and examples (2 to 5 objects with input, label, reason, evidence).

        \(rules)
        """
    }
}

// MARK: - Compiler

struct RoundReport: Identifiable, Hashable {
    var id: Int { n }
    var n: Int
    var kind: String
    var results: [TestResult]
    var total: Int
    var diagnosis: String?
    var accuracy: Double { results.isEmpty ? 0 : Double(results.filter(\.ok).count) / Double(results.count) }
}

@MainActor
final class Compiler: ObservableObject {
    @Published var rounds: [RoundReport] = []
    @Published var phase = ""
    @Published var cloudCalls = 0
    @Published var deviceRuns = 0
    @Published var holdout: [TestResult] = []
    @Published var error: String?

    let models: Models
    init(models: Models) { self.models = models }

    func run(_ spec: Spec, _ program: Program, _ input: String) async throws -> Verdict {
        let start = Date()
        let (json, onDevice) = try await models.deviceJSON(Prompts.device(spec, program, input))
        guard let label = matchLabel(json["label"] as? String ?? "", spec.labels) else {
            throw NSError(domain: "Cantrip", code: 1, userInfo: [NSLocalizedDescriptionKey: "The device answered with a label outside the program."])
        }
        let evidence = (json["evidence"] as? String).flatMap { e -> String? in
            let t = e.trimmingCharacters(in: CharacterSet(charactersIn: "\"“” ."))
            return t.count >= 3 && input.localizedCaseInsensitiveContains(t) ? t : nil
        }
        return Verdict(label: label, reason: json["reason"] as? String ?? "", evidence: evidence,
                       flagged: spec.flagLabels.contains(label), onDevice: onDevice,
                       ms: Int(Date().timeIntervalSince(start) * 1000))
    }

    private func examples(_ any: Any?, _ spec: Spec, _ tests: [TestCase]) -> [Example] {
        let testInputs = Set(tests.map { clip($0.input).lowercased() })
        return ((any as? [[String: Any]]) ?? []).compactMap { e in
            guard let input = e["input"] as? String, let label = matchLabel(e["label"] as? String ?? "", spec.labels),
                  !testInputs.contains(clip(input).lowercased()) else { return nil }
            return Example(input: input, label: label, reason: e["reason"] as? String ?? "", evidence: e["evidence"] as? String ?? "")
        }
    }

    private func revised(_ json: [String: Any], _ spec: Spec, _ tests: [TestCase], _ previous: Program) -> (Program, String) {
        let ex = examples(json["examples"], spec, tests)
        let sp = (json["systemPrompt"] as? String) ?? ""
        return (Program(systemPrompt: sp.isEmpty ? previous.systemPrompt : sp, examples: ex.count >= 2 ? ex : previous.examples),
                json["diagnosis"] as? String ?? "")
    }

    private func evaluate(_ spec: Spec, _ program: Program, _ tests: [TestCase], into round: Int?) async -> [TestResult] {
        var out: [TestResult] = []
        for t in tests {
            var r = TestResult(testId: t.id, expected: t.expected, got: nil, reason: "", ok: false, onDevice: true)
            if let v = try? await run(spec, program, t.input) {
                r.got = v.label; r.reason = v.reason; r.ok = v.label == t.expected; r.onDevice = v.onDevice
            }
            out.append(r)
            deviceRuns += 1
            if let round { rounds[round].results.append(r) } else { holdout.append(r) }
        }
        return out
    }

    /// Port a cantrip compiled on another device to Apple's model, then tune it here.
    func compileForThisDevice(_ c: Cantrip, maxRounds: Int = 4) async -> Cantrip? {
        error = nil; rounds = []; holdout = []; cloudCalls = 0; deviceRuns = 0
        let tune = c.tests.filter { $0.split == "tune" }
        let held = c.tests.filter { $0.split == "holdout" }
        do {
            var program: Program
            var kind = "repair"
            if let own = c.program(for: .appleFM) {
                program = own.program
            } else {
                guard let other = c.programs.values.max(by: { $0.tuneAccuracy < $1.tuneAccuracy }) else { throw CompileError.noProgram }
                phase = "☁ Gemini is adapting the program for Apple's model…"
                let json = try await models.cloudJSON(Prompts.port(c.spec, other.program))
                cloudCalls += 1
                program = revised(json, c.spec, c.tests, other.program).0
                kind = "port"
            }
            var best: (Program, Double, [TestResult])? = nil
            for n in 1...maxRounds {
                phase = "▣ Running the tests on this iPhone…"
                rounds.append(RoundReport(n: n, kind: n == 1 ? kind : "repair", results: [], total: tune.count))
                let results = await evaluate(c.spec, program, tune, into: rounds.count - 1)
                let acc = rounds[rounds.count - 1].accuracy
                if best == nil || acc > best!.1 { best = (program, acc, results) }
                if acc >= 0.999 || n == maxRounds { break }
                phase = "☁ Gemini is reading the failures and rewriting the program…"
                let json = try await models.cloudJSON(Prompts.repair(c.spec, best!.0, c.tests, best!.2))
                cloudCalls += 1
                let (next, diagnosis) = revised(json, c.spec, c.tests, best!.0)
                rounds[rounds.count - 1].diagnosis = diagnosis
                program = next
            }
            phase = "▣ Checking it on tests the repairs never saw…"
            let heldResults = await evaluate(c.spec, best!.0, held, into: nil)
            let heldAcc = heldResults.isEmpty ? nil : Double(heldResults.filter(\.ok).count) / Double(heldResults.count)
            var next = c
            next.programs[Target.appleFM.rawValue] = CompiledProgram(target: .appleFM, program: best!.0, tuneAccuracy: best!.1, holdoutAccuracy: heldAcc)
            phase = "Compiled."
            return next
        } catch {
            self.error = error.localizedDescription
            phase = ""
            return nil
        }
    }
}
