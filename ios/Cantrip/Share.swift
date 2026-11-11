import Foundation
import FirebaseFirestore

/// Installs a cantrip someone shared from Chrome (or another iPhone) by its 7-character code.
/// Reading a shared cantrip needs no sign-in; firestore.rules allows public reads by code.
enum Share {
    static func install(code raw: String) async throws -> Cantrip? {
        let code = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard code.range(of: "^[a-z0-9]{7}$", options: .regularExpression) != nil else { return nil }
        let snap = try await Firestore.firestore().collection("shared").document(code).getDocument()
        guard let data = snap.data() else { return nil }
        // Keep only the JSON parts we need; createdAt is a Firestore timestamp.
        let slim: [String: Any] = ["spec": data["spec"] ?? [:], "tests": data["tests"] ?? [], "programs": data["programs"] ?? [:]]
        let json = try JSONSerialization.data(withJSONObject: slim)
        struct Shared: Decodable { var spec: Spec; var tests: [TestCase]; var programs: [String: CompiledProgram] }
        let shared = try JSONDecoder().decode(Shared.self, from: json)
        return Cantrip(id: UUID().uuidString, spec: shared.spec, tests: shared.tests, programs: shared.programs, shareCode: code)
    }
}
