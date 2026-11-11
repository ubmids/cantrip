import SwiftUI

@MainActor
final class Library: ObservableObject {
    @Published var cantrips: [Cantrip] = Store.load()
    func upsert(_ c: Cantrip) {
        if let i = cantrips.firstIndex(where: { $0.id == c.id }) { cantrips[i] = c } else { cantrips.insert(c, at: 0) }
        Store.save(cantrips)
    }
    func remove(_ c: Cantrip) { cantrips.removeAll { $0.id == c.id }; Store.save(cantrips) }
}

struct LibraryView: View {
    @StateObject private var library = Library()
    @StateObject private var models = Models()
    @State private var code = ""
    @State private var installing = false
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            List {
                if let p = models.deviceProblem {
                    Label(p, systemImage: "iphone.slash").foregroundStyle(.orange)
                }
                Section("Install a shared cantrip") {
                    HStack {
                        TextField("7-character code", text: $code)
                            .textInputAutocapitalization(.never).autocorrectionDisabled().font(.body.monospaced())
                        Button(installing ? "…" : "Install") { Task { await install() } }
                            .disabled(installing || code.count < 7)
                    }
                    if let problem { Text(problem).font(.footnote).foregroundStyle(.red) }
                }
                Section("Your cantrips") {
                    if library.cantrips.isEmpty {
                        Text("Compile a rule in Chrome, press Share, and type its code here.").foregroundStyle(.secondary)
                    }
                    ForEach(library.cantrips) { c in
                        NavigationLink(value: c.id) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(c.spec.name).font(.headline)
                                Text(c.spec.intent).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                                HStack(spacing: 6) {
                                    TargetBadge(label: "Chrome", on: c.program(for: .geminiNano) != nil)
                                    TargetBadge(label: "iPhone", on: c.program(for: .appleFM) != nil)
                                }
                            }
                        }
                    }
                    .onDelete { idx in idx.map { library.cantrips[$0] }.forEach(library.remove) }
                }
            }
            .navigationTitle("Cantrip")
            .navigationDestination(for: String.self) { id in
                if let c = library.cantrips.first(where: { $0.id == id }) {
                    DetailView(cantrip: c, library: library, models: models)
                }
            }
        }
    }

    private func install() async {
        installing = true; problem = nil
        defer { installing = false }
        do {
            if let c = try await Share.install(code: code) { library.upsert(c); code = "" }
            else { problem = "No cantrip has that code." }
        } catch { problem = error.localizedDescription }
    }
}

struct TargetBadge: View {
    let label: String; let on: Bool
    var body: some View {
        Text(label).font(.caption2.weight(.semibold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(on ? Color.green.opacity(0.18) : Color.secondary.opacity(0.12), in: Capsule())
            .foregroundStyle(on ? .green : .secondary)
    }
}

struct DetailView: View {
    let cantrip: Cantrip
    @ObservedObject var library: Library
    @ObservedObject var models: Models
    @StateObject private var compiler: Compiler
    @State private var text = ""
    @State private var verdict: Verdict?
    @State private var running = false
    @State private var runError: String?

    init(cantrip: Cantrip, library: Library, models: Models) {
        self.cantrip = cantrip; self.library = library; self.models = models
        _compiler = StateObject(wrappedValue: Compiler(models: models))
    }

    private var compiled: CompiledProgram? { cantrip.program(for: .appleFM) }

    var body: some View {
        List {
            Section { Text(cantrip.spec.intent) } header: { Text("The rule") }

            Section {
                if let compiled {
                    LabeledContent("Tune tests", value: percent(compiled.tuneAccuracy))
                    LabeledContent("Unseen tests", value: compiled.holdoutAccuracy.map(percent) ?? "–")
                }
                Button(compiled == nil ? "Compile for this iPhone" : "Retune on this iPhone") {
                    Task { if let next = await compiler.compileForThisDevice(cantrip) { library.upsert(next) } }
                }
                .disabled(!models.deviceAvailable || !compiler.phase.isEmpty && compiler.phase != "Compiled.")
                if !compiler.phase.isEmpty { Text(compiler.phase).font(.footnote) }
                if let e = compiler.error { Text(e).font(.footnote).foregroundStyle(.red) }
                if compiler.cloudCalls + compiler.deviceRuns > 0 {
                    HStack {
                        Label("\(compiler.cloudCalls) cloud", systemImage: "cloud").foregroundStyle(.blue)
                        Spacer()
                        Label("\(compiler.deviceRuns) on device", systemImage: "iphone").foregroundStyle(.green)
                    }.font(.caption)
                }
                ForEach(compiler.rounds) { r in
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Round \(r.n) · \(r.kind == "port" ? "ported from Chrome" : "repair") · \(r.results.filter(\.ok).count)/\(r.total)")
                            .font(.subheadline.weight(.semibold))
                        Dots(results: r.results, total: r.total)
                        if let d = r.diagnosis, !d.isEmpty { Text("☁ \(d)").font(.caption).foregroundStyle(.secondary) }
                    }
                }
                if !compiler.holdout.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Unseen tests · \(compiler.holdout.filter(\.ok).count)/\(compiler.holdout.count)").font(.subheadline.weight(.semibold))
                        Dots(results: compiler.holdout, total: compiler.holdout.count)
                    }
                }
            } header: { Text("Apple's on-device model") }

            if let compiled {
                Section {
                    TextEditor(text: $text).frame(minHeight: 120)
                    Button(running ? "Checking on this iPhone…" : "Check") { Task { await check(compiled.program) } }
                        .disabled(running || text.trimmingCharacters(in: .whitespaces).isEmpty)
                    if let verdict {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(verdict.label).font(.headline).foregroundStyle(verdict.flagged ? .red : .primary)
                            Text(verdict.reason)
                            if let e = verdict.evidence { Text("“\(e)”").italic().foregroundStyle(.secondary) }
                            Text(verdict.onDevice ? "Ran on this iPhone · \(verdict.ms) ms · nothing sent" : "Ran in the cloud")
                                .font(.caption).foregroundStyle(verdict.onDevice ? .green : .blue)
                        }
                    }
                    if let runError { Text(runError).font(.footnote).foregroundStyle(.red) }
                } header: { Text("Try it") }
            }
        }
        .navigationTitle(cantrip.spec.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func check(_ p: Program) async {
        running = true; runError = nil; verdict = nil
        defer { running = false }
        do { verdict = try await compiler.run(cantrip.spec, p, text) } catch { runError = error.localizedDescription }
    }

    private func percent(_ x: Double) -> String { "\(Int((x * 100).rounded()))%" }
}

struct Dots: View {
    let results: [TestResult]; let total: Int
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<max(total, results.count), id: \.self) { i in
                Circle().frame(width: 10, height: 10)
                    .foregroundStyle(i < results.count ? (results[i].ok ? Color.green : Color.red) : Color.secondary.opacity(0.25))
            }
        }
    }
}
