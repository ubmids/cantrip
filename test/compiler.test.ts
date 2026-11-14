import { describe, expect, it } from "vitest";
import { addCorrection, compileIntent, recompile, splitTests, type CompileEvent } from "../src/core/compiler";
import { devicePrompt } from "../src/core/prompts";
import { locateEvidence, matchLabel, runProgram } from "../src/core/run";
import { counterIds, FakeDevice, ScriptedCloud } from "./fakes";

const intent = "Warn me when a job post is really commission-only";

const tests = [
  { input: "Base salary $80k plus bonus. Full benefits.", expected: "fine", why: "Salary stated." },
  { input: "Earn unlimited income! Pay is 100% commission on every sale.", expected: "commission only", why: "Says commission." },
  { input: "No base pay, you keep 30% of what you close.", expected: "commission only", why: "No base." },
  { input: "Hourly rate $25, weekly pay, overtime available.", expected: "fine", why: "Hourly." },
  { input: "Be your own boss, uncapped earnings, commission only role.", expected: "commission only", why: "Says commission." },
  { input: "Salary range 60-70k with stock options.", expected: "fine", why: "Salary." },
  { input: "Unpaid internship for exposure, no stipend.", expected: "unpaid", why: "Unpaid." },
  { input: "Volunteer position, unpaid, flexible hours.", expected: "unpaid", why: "Unpaid." },
  { input: "This is an unpaid trial week before hiring.", expected: "unpaid", why: "Unpaid." },
];

const design = {
  name: "Commission-only job",
  description: "Flags job posts with no guaranteed pay.",
  labels: ["Fine", "commission only", "unpaid"],
  flagLabels: ["commission only", "unpaid"],
  // The first draft only teaches one signal, so the device misses the others.
  systemPrompt: "Decide if the job pays. signal: commission -> commission only",
  examples: [
    { input: "Salary 50k.", label: "fine", reason: "Salary.", evidence: "Salary 50k" },
    { input: "Commission based pay.", label: "commission only", reason: "Commission.", evidence: "Commission based" },
    // Copies a test verbatim: must be dropped so accuracy stays honest.
    { input: tests[6].input, label: "unpaid", reason: "Unpaid.", evidence: "Unpaid internship" },
  ],
  tests,
};

const repairGood = {
  diagnosis: "It never learned the unpaid and no-base signals.",
  systemPrompt:
    "Decide if the job pays. signal: commission -> commission only\nsignal: no base -> commission only\nsignal: unpaid -> unpaid",
  examples: [
    { input: "Salary 50k.", label: "fine", reason: "Salary.", evidence: "Salary 50k" },
    { input: "Volunteer role, unpaid.", label: "unpaid", reason: "Unpaid.", evidence: "unpaid" },
  ],
};

function collect() {
  const events: CompileEvent[] = [];
  return { events, onEvent: (e: CompileEvent) => events.push(e) };
}

describe("splitTests", () => {
  it("holds out every third case per label", () => {
    const s = splitTests(tests.map((t, i) => ({ ...t, id: String(i), origin: "generated" as const })));
    expect(s.filter((t) => t.split === "holdout").map((t) => t.input)).toEqual([
      tests[4].input,
      tests[5].input,
      tests[8].input,
    ]);
  });
});

describe("compileIntent", () => {
  it("designs in the cloud, tests on the device, repairs until it passes", async () => {
    const cloud = new ScriptedCloud([design, repairGood]);
    const device = new FakeDevice("fine");
    const { events, onEvent } = collect();
    const c = await compileIntent(intent, { cloud, device, target: "gemini-nano", makeId: counterIds(), clock: () => 1000, onEvent });

    const compiled = c.programs["gemini-nano"]!;
    expect(c.spec.labels).toEqual(["fine", "commission only", "unpaid"]);
    expect(c.spec.intent).toBe(intent);
    expect(compiled.rounds.map((r) => r.kind)).toEqual(["design", "repair"]);
    expect(compiled.rounds[0].accuracy).toBeLessThan(1);
    expect(compiled.tuneAccuracy).toBe(1);
    expect(compiled.holdoutAccuracy).toBe(1);
    expect(compiled.cloudCalls).toBe(2);
    // 6 tune cases in two rounds, then 3 holdout cases once.
    expect(compiled.deviceCalls).toBe(6 * 2 + 3);
    expect(device.calls).toHaveLength(15);
    expect(events[0]).toEqual({ type: "designing" });
    expect(events.at(-1)?.type).toBe("done");
  });

  it("drops examples that copy a test, so reported accuracy is earned", async () => {
    const cloud = new ScriptedCloud([design, repairGood]);
    const c = await compileIntent(intent, { cloud, device: new FakeDevice(), target: "gemini-nano", makeId: counterIds() });
    const draft = c.programs["gemini-nano"]!.rounds[0].program;
    expect(draft.examples.map((e) => e.input)).not.toContain(tests[6].input);
  });

  it("never sends holdout cases to the repair prompt", async () => {
    const cloud = new ScriptedCloud([design, repairGood]);
    const c = await compileIntent(intent, { cloud, device: new FakeDevice(), target: "gemini-nano", makeId: counterIds() });
    const holdout = c.tests.filter((t) => t.split === "holdout");
    for (const t of holdout) expect(cloud.prompts[1]).not.toContain(t.input);
  });

  it("keeps the best program when a repair makes things worse", async () => {
    const worse = { diagnosis: "x", systemPrompt: "Decide if the job pays.", examples: repairGood.examples };
    const cloud = new ScriptedCloud([design, worse]);
    const c = await compileIntent(intent, { cloud, device: new FakeDevice(), target: "gemini-nano", maxRounds: 2, makeId: counterIds() });
    const compiled = c.programs["gemini-nano"]!;
    expect(compiled.rounds[1].accuracy).toBeLessThan(compiled.rounds[0].accuracy);
    expect(compiled.program.systemPrompt).toBe(design.systemPrompt);
  });

  it("stops early without calling the cloud again once every tune case passes", async () => {
    const perfect = { ...design, systemPrompt: repairGood.systemPrompt };
    const cloud = new ScriptedCloud([perfect]);
    const c = await compileIntent(intent, { cloud, device: new FakeDevice(), target: "gemini-nano", makeId: counterIds() });
    expect(c.programs["gemini-nano"]!.rounds).toHaveLength(1);
    expect(cloud.prompts).toHaveLength(1);
  });

  it("keeps the best program when the cloud fails in the middle of the repair loop", async () => {
    // Only the design is scripted, so the first repair call throws, as a network failure would.
    const { events, onEvent } = collect();
    const c = await compileIntent(intent, { cloud: new ScriptedCloud([design]), device: new FakeDevice(), target: "gemini-nano", makeId: counterIds(), onEvent });
    const compiled = c.programs["gemini-nano"]!;
    expect(compiled.rounds).toHaveLength(1);
    expect(compiled.program.systemPrompt).toBe(design.systemPrompt);
    expect(compiled.tuneAccuracy).toBe(compiled.rounds[0].accuracy);
    expect(compiled.cloudCalls).toBe(1);
    expect(compiled.holdoutResults.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "repair-failed")).toBe(true);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("rejects a design without a warning label", async () => {
    const cloud = new ScriptedCloud([{ ...design, flagLabels: ["nonsense"] }]);
    await expect(compileIntent(intent, { cloud, device: new FakeDevice(), target: "gemini-nano" })).rejects.toThrow(/warn/);
  });

  it("records a device failure as a failed test instead of crashing", async () => {
    const broken = { generateJson: async () => ({ data: { label: "banana", reason: "", evidence: "" }, raw: "", source: "on_device" as const }) };
    const cloud = new ScriptedCloud([design, repairGood, repairGood, repairGood]);
    const c = await compileIntent(intent, { cloud, device: broken, target: "gemini-nano", makeId: counterIds() });
    const compiled = c.programs["gemini-nano"]!;
    expect(compiled.tuneAccuracy).toBe(0);
    expect(compiled.rounds[0].results[0].error).toMatch(/outside the program/);
  });
});

describe("recompile", () => {
  it("ports a program to another device's model, then tunes it there", async () => {
    const first = await compileIntent(intent, {
      cloud: new ScriptedCloud([design, repairGood]),
      device: new FakeDevice(),
      target: "gemini-nano",
      makeId: counterIds(),
    });
    const cloud = new ScriptedCloud([{ ...repairGood, diagnosis: "Shorter wording." }]);
    const { events, onEvent } = collect();
    const ported = await recompile(first, { cloud, device: new FakeDevice(), target: "apple-fm", onEvent });
    expect(events[0]).toEqual({ type: "porting", from: "gemini-nano" });
    expect(ported.programs["apple-fm"]!.rounds[0].kind).toBe("port");
    expect(ported.programs["apple-fm"]!.tuneAccuracy).toBe(1);
    expect(ported.programs["gemini-nano"]).toEqual(first.programs["gemini-nano"]);
    expect(cloud.prompts[0]).toContain("Apple's on-device Foundation Model");
  });

  it("learns from a correction", async () => {
    const c = await compileIntent(intent, {
      cloud: new ScriptedCloud([design, repairGood]),
      device: new FakeDevice(),
      target: "gemini-nano",
      makeId: counterIds(),
    });
    const text = "Draw on a share of the profits instead of wages.";
    const corrected = addCorrection(c, text, "commission only", () => "user1");
    const t = corrected.tests.find((x) => x.id === "user1")!;
    expect(t).toMatchObject({ split: "tune", origin: "user", expected: "commission only" });

    const learned = {
      diagnosis: "Profit share without wages is commission.",
      systemPrompt: repairGood.systemPrompt + "\nsignal: share of the profits -> commission only",
      examples: repairGood.examples,
    };
    const cloud = new ScriptedCloud([learned]);
    const next = await recompile(corrected, { cloud, device: new FakeDevice(), target: "gemini-nano" });
    expect(cloud.prompts[0]).toContain(text);
    expect(next.programs["gemini-nano"]!.tuneAccuracy).toBe(1);
  });

  it("refuses a correction with a label the cantrip doesn't have", () => {
    const c = { spec: { labels: ["fine", "bad"] }, tests: [] } as never;
    expect(() => addCorrection(c, "x", "maybe")).toThrow(/not one of/);
  });
});

describe("runProgram", () => {
  const spec = { name: "x", intent, description: "", labels: ["fine", "commission only"], flagLabels: ["commission only"] };

  it("flags, quotes real evidence and reports where it ran", async () => {
    const v = await runProgram(new FakeDevice(), spec, { systemPrompt: "signal: commission -> commission only", examples: [] }, "Great team. Commission only, no salary.");
    expect(v).toMatchObject({ label: "commission only", flagged: true, source: "on_device", evidence: "Commission" });
  });

  it("drops evidence the model made up", () => {
    expect(locateEvidence("Base pay is 50k", "unlimited earnings")).toBeNull();
    expect(locateEvidence("Base   pay is 50k", "“base pay”")).toBe("Base pay");
  });

  it("matches labels loosely", () => {
    expect(matchLabel("Commission_Only", spec.labels)).toBe("commission only");
    expect(matchLabel("maybe", spec.labels)).toBeNull();
  });

  it("builds a single-turn device prompt with the allowed labels", () => {
    const p = devicePrompt(spec, { systemPrompt: "Do it.", examples: [] }, "hello");
    expect(p).toContain("fine | commission only");
    expect(p.trim().endsWith("Answer:")).toBe(true);
  });
});
