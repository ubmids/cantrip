import Foundation

// Mirrors src/core/types.ts. A cantrip shared from Chrome arrives with a
// program compiled for "gemini-nano"; this app compiles its own "apple-fm" one.

enum Target: String, Codable { case geminiNano = "gemini-nano", appleFM = "apple-fm" }

struct Spec: Codable, Hashable {
    var name: String
    var intent: String
    var description: String
    var labels: [String]
    var flagLabels: [String]
}

struct Example: Codable, Hashable {
    var input: String
    var label: String
    var reason: String
    var evidence: String
}

struct Program: Codable, Hashable {
    var systemPrompt: String
    var examples: [Example]
}

struct TestCase: Codable, Hashable, Identifiable {
    var id: String
    var input: String
    var expected: String
    var why: String
    var origin: String
    var split: String
}

struct TestResult: Codable, Hashable {
    var testId: String
    var expected: String
    var got: String?
    var reason: String
    var ok: Bool
    var onDevice: Bool
}

struct CompiledProgram: Codable, Hashable {
    var target: Target
    var program: Program
    var tuneAccuracy: Double
    var holdoutAccuracy: Double?
}

struct Cantrip: Codable, Hashable, Identifiable {
    var id: String
    var spec: Spec
    var tests: [TestCase]
    var programs: [String: CompiledProgram]
    var shareCode: String?

    func program(for t: Target) -> CompiledProgram? { programs[t.rawValue] }
}

struct Verdict: Hashable {
    var label: String
    var reason: String
    var evidence: String?
    var flagged: Bool
    var onDevice: Bool
    var ms: Int
}

enum Store {
    private static let key = "cantrip.v1"
    static func load() -> [Cantrip] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([Cantrip].self, from: data)) ?? []
    }
    static func save(_ list: [Cantrip]) {
        if let data = try? JSONEncoder().encode(list) { UserDefaults.standard.set(data, forKey: key) }
    }
}
