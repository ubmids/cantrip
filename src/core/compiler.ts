import { asArray, asRecord, asString } from "./json";
import { designPrompt, designSchema, portPrompt, repairPrompt, repairSchema } from "./prompts";
import { locateEvidence, matchLabel, runProgram } from "./run";
import type {
  Cantrip,
  CompiledProgram,
  Example,
  JsonModel,
  Program,
  Round,
  Spec,
  Target,
  TestCase,
  TestResult,
} from "./types";

export type CompileEvent =
  | { type: "designing" }
  | { type: "designed"; spec: Spec; tests: TestCase[]; program: Program }
  | { type: "round-start"; round: number; kind: Round["kind"]; program: Program }
  | { type: "test-result"; round: number; result: TestResult }
  | { type: "round-end"; round: Round; best: number }
  | { type: "repairing"; round: number; failures: number }
  | { type: "repaired"; round: number; diagnosis: string }
  | { type: "repair-failed"; round: number; error: string }
  | { type: "porting"; from: Target }
  | { type: "holdout-start"; count: number }
  | { type: "holdout-result"; result: TestResult }
  | { type: "done"; cantrip: Cantrip; compiled: CompiledProgram };

export interface CompileOptions {
  cloud: JsonModel;
  device: JsonModel;
  target: Target;
  /** Total device evaluation rounds, including the first draft. */
  maxRounds?: number;
  onEvent?: (e: CompileEvent) => void;
  signal?: AbortSignal;
  /** Injected for deterministic ids in tests. */
  makeId?: () => string;
  clock?: () => number;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function defaultId(): string {
  const a = new Uint8Array(8);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function slugLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanExamples(raw: unknown, labels: string[], tests: TestCase[]): Example[] {
  const testInputs = new Set(tests.map((t) => norm(t.input)));
  const out: Example[] = [];
  for (const item of asArray(raw)) {
    const r = asRecord(item);
    const input = asString(r.input).trim();
    const label = matchLabel(asString(r.label), labels);
    if (!input || !label) continue;
    // A program that memorises its own tests would report accuracy it doesn't have.
    if (testInputs.has(norm(input))) continue;
    out.push({
      input,
      label,
      reason: asString(r.reason).trim(),
      evidence: locateEvidence(input, asString(r.evidence)) ?? "",
    });
  }
  return out.slice(0, 5);
}

/** Stratified split: roughly a third of each label's cases are held out from the repair loop. */
export function splitTests(tests: Omit<TestCase, "split">[]): TestCase[] {
  const byLabel = new Map<string, number>();
  return tests.map((t) => {
    const n = (byLabel.get(t.expected) ?? 0) + 1;
    byLabel.set(t.expected, n);
    return { ...t, split: n % 3 === 0 ? "holdout" : "tune" } as TestCase;
  });
}

export function parseDesign(
  data: unknown,
  intent: string,
  makeId: () => string,
): { spec: Spec; program: Program; tests: TestCase[] } {
  const d = asRecord(data);
  const labels = [...new Set(asArray(d.labels).map((l) => slugLabel(asString(l))).filter(Boolean))].slice(0, 4);
  if (labels.length < 2) throw new Error("The compiler returned fewer than two labels.");
  const flagLabels = asArray(d.flagLabels)
    .map((l) => matchLabel(asString(l), labels))
    .filter((l): l is string => !!l);
  if (flagLabels.length === 0) throw new Error("The compiler did not say which label should warn you.");
  const spec: Spec = {
    name: asString(d.name).trim() || "Untitled cantrip",
    intent: intent.trim(),
    description: asString(d.description).trim(),
    labels,
    flagLabels: [...new Set(flagLabels)],
  };
  const seen = new Set<string>();
  const rawTests: Omit<TestCase, "split">[] = [];
  for (const item of asArray(d.tests)) {
    const r = asRecord(item);
    const input = asString(r.input).trim();
    const expected = matchLabel(asString(r.expected), labels);
    if (!input || !expected || seen.has(norm(input))) continue;
    seen.add(norm(input));
    rawTests.push({ id: makeId(), input, expected, why: asString(r.why).trim(), origin: "generated" });
  }
  if (rawTests.length < 4) throw new Error("The compiler returned too few usable tests.");
  const tests = splitTests(rawTests);
  const program: Program = {
    systemPrompt: asString(d.systemPrompt).trim(),
    examples: cleanExamples(d.examples, labels, tests),
  };
  if (!program.systemPrompt) throw new Error("The compiler returned an empty program.");
  return { spec, program, tests };
}

function parseRepair(data: unknown, spec: Spec, tests: TestCase[], previous: Program): { program: Program; diagnosis: string } {
  const d = asRecord(data);
  const systemPrompt = asString(d.systemPrompt).trim();
  const examples = cleanExamples(d.examples, spec.labels, tests);
  return {
    diagnosis: asString(d.diagnosis).trim(),
    program: {
      systemPrompt: systemPrompt || previous.systemPrompt,
      examples: examples.length >= 2 ? examples : previous.examples,
    },
  };
}

export async function evaluate(
  device: JsonModel,
  spec: Spec,
  program: Program,
  tests: TestCase[],
  onResult?: (r: TestResult) => void,
  signal?: AbortSignal,
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const t of tests) {
    if (signal?.aborted) throw new DOMException("Compile cancelled", "AbortError");
    let r: TestResult;
    try {
      const v = await runProgram(device, spec, program, t.input);
      r = { testId: t.id, expected: t.expected, got: v.label, reason: v.reason, ok: v.label === t.expected, ms: v.ms, source: v.source };
    } catch (err) {
      r = { testId: t.id, expected: t.expected, got: null, reason: "", ok: false, ms: 0, source: null, error: String((err as Error)?.message ?? err) };
    }
    results.push(r);
    onResult?.(r);
  }
  return results;
}

const accuracy = (rs: TestResult[]) => (rs.length ? rs.filter((r) => r.ok).length / rs.length : 0);

/**
 * The repair loop. Runs the program on the device against the tune cases,
 * asks the cloud to fix what failed, and keeps the best program it has seen.
 * Then reports accuracy on held-out cases that never steered a repair.
 */
async function tune(
  opts: CompileOptions,
  spec: Spec,
  tests: TestCase[],
  start: Program,
  firstKind: Round["kind"],
  counters: { cloud: number; device: number },
): Promise<Omit<CompiledProgram, "compiledAt">> {
  const { cloud, device, target, onEvent, signal } = opts;
  const maxRounds = Math.max(1, opts.maxRounds ?? 4);
  const tuneSet = tests.filter((t) => t.split === "tune");
  const holdout = tests.filter((t) => t.split === "holdout");
  const rounds: Round[] = [];
  let program = start;
  let best: Round | null = null;

  for (let n = 1; n <= maxRounds; n++) {
    const kind: Round["kind"] = n === 1 ? firstKind : "repair";
    onEvent?.({ type: "round-start", round: n, kind, program });
    const results = await evaluate(device, spec, program, tuneSet, (result) => onEvent?.({ type: "test-result", round: n, result }), signal);
    counters.device += results.length;
    const round: Round = { round: n, kind, program, results, accuracy: accuracy(results) };
    rounds.push(round);
    if (!best || round.accuracy > best.accuracy) best = round;
    onEvent?.({ type: "round-end", round, best: best.accuracy });
    if (round.accuracy >= 0.999 || n === maxRounds) break;

    const failures = results.filter((r) => !r.ok).length;
    onEvent?.({ type: "repairing", round: n, failures });
    // Repair from the best program so far, so one bad rewrite can't drag the loop backwards.
    let fixed: ReturnType<typeof parseRepair>;
    try {
      const res = await cloud.generateJson(repairPrompt(spec, best.program, tests, best.results, target), repairSchema);
      counters.cloud += 1;
      fixed = parseRepair(res.data, spec, tests, best.program);
    } catch (err) {
      // The cloud is out of reach or overloaded. The best program so far already runs on the
      // device, so keep it and finish, rather than throwing the whole compile away.
      onEvent?.({ type: "repair-failed", round: n, error: String((err as Error)?.message ?? err) });
      break;
    }
    onEvent?.({ type: "repaired", round: n, diagnosis: fixed.diagnosis });
    program = fixed.program;
  }

  const chosen = best!;
  let holdoutResults: TestResult[] = [];
  if (holdout.length) {
    onEvent?.({ type: "holdout-start", count: holdout.length });
    holdoutResults = await evaluate(device, spec, chosen.program, holdout, (result) => onEvent?.({ type: "holdout-result", result }), signal);
    counters.device += holdoutResults.length;
  }
  return {
    target,
    program: chosen.program,
    tuneAccuracy: chosen.accuracy,
    holdoutAccuracy: holdout.length ? accuracy(holdoutResults) : null,
    holdoutResults,
    rounds,
    cloudCalls: counters.cloud,
    deviceCalls: counters.device,
  };
}

/** Compile a brand-new cantrip from the person's words. */
export async function compileIntent(intent: string, opts: CompileOptions): Promise<Cantrip> {
  const makeId = opts.makeId ?? defaultId;
  const clock = opts.clock ?? Date.now;
  if (!intent.trim()) throw new Error("Describe what the cantrip should watch for.");
  opts.onEvent?.({ type: "designing" });
  const counters = { cloud: 0, device: 0 };
  const res = await opts.cloud.generateJson(designPrompt(intent, opts.target), designSchema);
  counters.cloud += 1;
  const { spec, program, tests } = parseDesign(res.data, intent, makeId);
  opts.onEvent?.({ type: "designed", spec, tests, program });
  const tuned = await tune(opts, spec, tests, program, "design", counters);
  const compiled: CompiledProgram = { ...tuned, compiledAt: clock() };
  const t = clock();
  const cantrip: Cantrip = {
    id: makeId(),
    spec,
    tests,
    programs: { [opts.target]: compiled },
    enabled: true,
    createdAt: t,
    updatedAt: t,
  };
  opts.onEvent?.({ type: "done", cantrip, compiled });
  return cantrip;
}

/**
 * Recompile an existing cantrip for a target: after the person corrected a
 * verdict, or to bring a cantrip compiled on one device to another. When the
 * target has no program yet, the cloud first ports the other target's
 * program, then the usual repair loop tunes it on this device.
 */
export async function recompile(cantrip: Cantrip, opts: CompileOptions): Promise<Cantrip> {
  const clock = opts.clock ?? Date.now;
  const counters = { cloud: 0, device: 0 };
  const own = cantrip.programs[opts.target];
  let start: Program;
  let kind: Round["kind"] = "repair";
  if (own) {
    start = own.program;
  } else {
    const other = (Object.values(cantrip.programs) as CompiledProgram[]).sort((a, b) => b.tuneAccuracy - a.tuneAccuracy)[0];
    if (!other) throw new Error("This cantrip has no program to start from.");
    opts.onEvent?.({ type: "porting", from: other.target });
    const res = await opts.cloud.generateJson(portPrompt(cantrip.spec, other.program, other.target, opts.target), repairSchema);
    counters.cloud += 1;
    start = parseRepair(res.data, cantrip.spec, cantrip.tests, other.program).program;
    kind = "port";
  }
  const tuned = await tune(opts, cantrip.spec, cantrip.tests, start, kind, counters);
  const compiled: CompiledProgram = { ...tuned, compiledAt: clock() };
  const next: Cantrip = {
    ...cantrip,
    programs: { ...cantrip.programs, [opts.target]: compiled },
    updatedAt: clock(),
  };
  opts.onEvent?.({ type: "done", cantrip: next, compiled });
  return next;
}

/**
 * Turn a person's correction into a test case. Corrections always steer the
 * repair loop, so the program learns from exactly what they disagreed with.
 */
export function addCorrection(cantrip: Cantrip, input: string, correctLabel: string, makeId: () => string = defaultId): Cantrip {
  const label = matchLabel(correctLabel, cantrip.spec.labels);
  if (!label) throw new Error(`"${correctLabel}" is not one of this cantrip's labels.`);
  const existing = cantrip.tests.find((t) => norm(t.input) === norm(input));
  const tests = existing
    ? cantrip.tests.map((t) => (t === existing ? { ...t, expected: label, origin: "user" as const, split: "tune" as const, why: "You corrected this one." } : t))
    : [...cantrip.tests, { id: makeId(), input, expected: label, why: "You corrected this one.", origin: "user" as const, split: "tune" as const }];
  return { ...cantrip, tests, updatedAt: Date.now() };
}
