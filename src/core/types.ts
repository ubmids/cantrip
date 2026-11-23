/**
 * Core types for Cantrip.
 *
 * A cantrip is a small, plain-English rule ("warn me when a job post is
 * really commission-only") that the cloud model compiles into a program the
 * on-device model can run reliably, for free, on every page.
 */

/** Which on-device model a program was compiled and tested against. */
export type Target = "gemini-nano" | "apple-fm";

/** Where a single inference ran, as reported by Firebase AI Logic. */
export type Source = "on_device" | "in_cloud";

export interface Spec {
  /** Short display name, e.g. "Commission-only job". */
  name: string;
  /** The user's own words. Never rewritten. */
  intent: string;
  /** One sentence the UI shows under the name. */
  description: string;
  /** Two to four lowercase labels the device must choose between. */
  labels: string[];
  /** Labels that should raise a visible flag when the device picks them. */
  flagLabels: string[];
}

export interface Example {
  input: string;
  label: string;
  reason: string;
  evidence: string;
}

/** What the device actually runs: a system prompt plus a few examples. */
export interface Program {
  systemPrompt: string;
  examples: Example[];
}

export interface TestCase {
  id: string;
  input: string;
  expected: string;
  /** Why the expected label is right. Shown in the compile view. */
  why: string;
  /** "generated" by the cloud, or a "user" correction. */
  origin: "generated" | "user";
  /** "tune" cases steer repairs; "holdout" cases are only used to report. */
  split: "tune" | "holdout";
}

export interface TestResult {
  testId: string;
  expected: string;
  got: string | null;
  reason: string;
  ok: boolean;
  ms: number;
  source: Source | null;
  error?: string;
}

export interface Round {
  round: number;
  /** "design" for the first draft, "repair" afterwards, "port" when seeded from another target. */
  kind: "design" | "repair" | "port";
  program: Program;
  results: TestResult[];
  /** Share of tune cases passed, 0..1. */
  accuracy: number;
}

export interface CompiledProgram {
  target: Target;
  program: Program;
  /** Tune-set accuracy of the chosen program, 0..1. */
  tuneAccuracy: number;
  /** Accuracy on cases the repair loop never saw, 0..1. Null when no holdout cases exist. */
  holdoutAccuracy: number | null;
  holdoutResults: TestResult[];
  rounds: Round[];
  cloudCalls: number;
  deviceCalls: number;
  compiledAt: number;
}

export interface Cantrip {
  id: string;
  spec: Spec;
  tests: TestCase[];
  programs: Partial<Record<Target, CompiledProgram>>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  /** Share code once published. */
  shareCode?: string;
  /** Where a cantrip that ships with the app came from, shown on its page. */
  provenance?: string;
}

export interface Verdict {
  label: string;
  reason: string;
  /** Exact quote from the input that drove the decision, when the model gave a valid one. */
  evidence: string | null;
  flagged: boolean;
  source: Source | null;
  ms: number;
}

/**
 * The only thing Cantrip needs from a model: send a prompt, get JSON back that
 * matches a schema, and learn where it ran. The Firebase adapter implements
 * this; tests use scripted fakes.
 */
export interface JsonModel {
  generateJson(prompt: string, schema: JsonSchema): Promise<JsonResult>;
}

export interface JsonResult {
  data: unknown;
  raw: string;
  source: Source | null;
}

/** The subset of JSON Schema that both Gemini and the Chrome Prompt API accept. */
export type JsonSchema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  description?: string;
  minItems?: number;
  maxItems?: number;
};
