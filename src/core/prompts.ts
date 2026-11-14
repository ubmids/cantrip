import type { Example, JsonSchema, Program, Spec, Target, TestCase, TestResult } from "./types";

/** Longest input the device sees. Keeps every prompt well under the on-device token limits. */
export const MAX_INPUT_CHARS = 3000;

export const TARGET_NAMES: Record<Target, string> = {
  "gemini-nano": "Gemini Nano running inside Chrome",
  "apple-fm": "Apple's on-device Foundation Model",
};

export function clip(text: string, max = MAX_INPUT_CHARS): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

// ---------------------------------------------------------------------------
// Device side
// ---------------------------------------------------------------------------

export function verdictSchema(labels: string[]): JsonSchema {
  return {
    type: "object",
    properties: {
      label: { type: "string", enum: labels },
      reason: { type: "string", description: "One short sentence." },
      evidence: {
        type: "string",
        description: "The exact words from the text that decided it, at most 12 words. Empty if none.",
      },
    },
    required: ["label", "reason", "evidence"],
  };
}

function exampleBlock(ex: Example): string {
  return `Text: """${clip(ex.input, 600)}"""\nAnswer: ${JSON.stringify({
    label: ex.label,
    reason: ex.reason,
    evidence: ex.evidence,
  })}`;
}

/**
 * The on-device prompt is single-turn on purpose: hybrid on-device inference
 * on the web does not support multi-turn chat, and a single turn keeps every
 * run independent and cheap.
 */
export function devicePrompt(spec: Spec, program: Program, input: string): string {
  const examples = program.examples.map(exampleBlock).join("\n\n");
  return [
    program.systemPrompt.trim(),
    `Choose exactly one label: ${spec.labels.join(" | ")}.`,
    examples ? `Examples:\n\n${examples}` : "",
    `Now answer for this text. Reply with JSON only.\nText: """${clip(input)}"""\nAnswer:`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Cloud side: the compiler
// ---------------------------------------------------------------------------

const exampleSchema: JsonSchema = {
  type: "object",
  properties: {
    input: { type: "string" },
    label: { type: "string" },
    reason: { type: "string" },
    evidence: { type: "string" },
  },
  required: ["input", "label", "reason", "evidence"],
};

const testSchema: JsonSchema = {
  type: "object",
  properties: {
    input: { type: "string" },
    expected: { type: "string" },
    why: { type: "string" },
  },
  required: ["input", "expected", "why"],
};

export const designSchema: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "2 to 4 words, title case." },
    description: { type: "string", description: "One sentence, starts with a verb." },
    labels: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    flagLabels: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    systemPrompt: { type: "string" },
    examples: { type: "array", items: exampleSchema, minItems: 2, maxItems: 4 },
    tests: { type: "array", items: testSchema, minItems: 9, maxItems: 14 },
  },
  required: ["name", "description", "labels", "flagLabels", "systemPrompt", "examples", "tests"],
};

export const repairSchema: JsonSchema = {
  type: "object",
  properties: {
    diagnosis: { type: "string", description: "What the small model got wrong, in one or two sentences." },
    systemPrompt: { type: "string" },
    examples: { type: "array", items: exampleSchema, minItems: 2, maxItems: 5 },
  },
  required: ["diagnosis", "systemPrompt", "examples"],
};

const RULES_FOR_SMALL_MODELS = `The program runs on a small on-device model with limited reasoning. Write for it:
- Open with one sentence that states the job.
- Then give a short numbered checklist of concrete signals to look for, with the label each signal points to.
- Say what to do when signals conflict or none are present. Missing information is not a signal: text that simply does not mention the subject gets the calm label.
- Use plain words. No nuance-heavy language, no long paragraphs.
- Keep the system prompt under 180 words.
- Examples must be realistic, varied, and short (under 80 words each). The evidence field is an exact quote from the example input, at most 12 words.`;

export function designPrompt(intent: string, target: Target): string {
  return `You are the compiler for Cantrip. A person described a rule in their own words. Turn it into a tiny classification program that ${TARGET_NAMES[target]} will run on every piece of text they read.

Their words: """${intent.trim()}"""

Produce:
1. name and description for the rule.
2. labels: 2 to 4 short lowercase labels (one or two words each). Include a calm "everything is fine" label.
3. flagLabels: the labels that should visibly warn the person.
4. systemPrompt: the instructions for the small model.
5. examples: 3 worked examples covering different labels.
6. tests: 12 realistic test texts with the expected label and why. Spread them across all labels. At least 4 must be hard: near-misses, sarcasm, mixed signals, or texts that use the right keywords but should not be flagged. None may repeat an example.

The program reads real pages one block at a time, so it often gets a fragment: a single paragraph or list item cut from a longer post, with no sign of what the rule is about. A fragment that does not itself show the thing to warn about must get the calm label. Say so in the systemPrompt, and make at least 2 of the tests such fragments (for example a list of duties or a company blurb) with the calm label expected.

${RULES_FOR_SMALL_MODELS}

Every label used in examples, tests and flagLabels must be one of labels.`;
}

export function repairPrompt(
  spec: Spec,
  program: Program,
  tests: TestCase[],
  results: TestResult[],
  target: Target,
): string {
  const byId = new Map(tests.map((t) => [t.id, t]));
  const failures = results
    .filter((r) => !r.ok)
    .map((r, i) => {
      const t = byId.get(r.testId);
      return `${i + 1}. Text: """${clip(t?.input ?? "", 500)}"""\n   Expected: ${r.expected}. The device said: ${r.got ?? "(no valid answer)"}${r.reason ? `, because "${r.reason}"` : ""}.${t?.why ? `\n   Why the expected label is right: ${t.why}` : ""}`;
    })
    .join("\n");
  const passed = results.filter((r) => r.ok).length;
  return `You are the compiler for Cantrip. You wrote a program for ${TARGET_NAMES[target]}, ran it on the device, and it passed ${passed} of ${results.length} tests. Fix it.

Rule in the person's words: """${spec.intent}"""
Labels: ${spec.labels.join(", ")}. Flag labels: ${spec.flagLabels.join(", ")}.

Current system prompt:
"""${program.systemPrompt}"""

Current examples:
${program.examples.map((e) => `- (${e.label}) ${clip(e.input, 300)}`).join("\n")}

Failures on the device:
${failures}

Diagnose why the small model failed, then rewrite the system prompt and examples so it gets these right without breaking the tests it already passes. Teach the general signal, not the specific test: never copy a failing test text into an example, and do not mention the tests.

${RULES_FOR_SMALL_MODELS}`;
}

export function portPrompt(spec: Spec, program: Program, from: Target, to: Target): string {
  return `You are the compiler for Cantrip. This program was tuned for ${TARGET_NAMES[from]}. Adapt it for ${TARGET_NAMES[to]}, keeping its behaviour identical. Small models differ in what wording they follow reliably, so rewrite where that helps.

Rule in the person's words: """${spec.intent}"""
Labels: ${spec.labels.join(", ")}.

System prompt:
"""${program.systemPrompt}"""

Examples:
${program.examples.map((e) => JSON.stringify(e)).join("\n")}

Return the adapted systemPrompt and examples, plus a one-line diagnosis of what you changed.

${RULES_FOR_SMALL_MODELS}`;
}
