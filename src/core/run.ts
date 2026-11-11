import { asRecord, asString } from "./json";
import { clip, devicePrompt, verdictSchema } from "./prompts";
import type { JsonModel, Program, Spec, Verdict } from "./types";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Match a model's label to one of the allowed labels, forgiving case and spacing. */
export function matchLabel(raw: string, labels: string[]): string | null {
  const n = norm(raw).replace(/[_-]+/g, " ");
  for (const l of labels) {
    if (norm(l).replace(/[_-]+/g, " ") === n) return l;
  }
  return null;
}

/**
 * Return the evidence quote exactly as it appears in the input, or null if
 * the model invented it. Highlights on a page must point at real words.
 */
export function locateEvidence(input: string, evidence: string): string | null {
  const e = evidence.replace(/^["'“”]+|["'“”.]+$/g, "").replace(/\s+/g, " ").trim();
  if (e.length < 3) return null;
  const flat = input.replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(e.toLowerCase());
  if (i < 0) return null;
  return flat.slice(i, i + e.length);
}

export async function runProgram(
  device: JsonModel,
  spec: Spec,
  program: Program,
  input: string,
): Promise<Verdict> {
  const started = now();
  const res = await device.generateJson(devicePrompt(spec, program, input), verdictSchema(spec.labels));
  const ms = Math.round(now() - started);
  const d = asRecord(res.data);
  const label = matchLabel(asString(d.label), spec.labels);
  if (!label) {
    throw new Error(`Device answered with a label outside the program: ${asString(d.label) || "(none)"}`);
  }
  return {
    label,
    reason: asString(d.reason).trim(),
    evidence: locateEvidence(clip(input), asString(d.evidence)),
    flagged: spec.flagLabels.includes(label),
    source: res.source,
    ms,
  };
}

export function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
