/**
 * Simulated models for preview builds (VITE_SIMULATE=1) and for showing the
 * interface before Firebase is connected. Nothing here is a real model: the
 * app labels every simulated session with a banner. Real builds use
 * Firebase AI Logic for every inference.
 */
import { asRecord } from "../core/json";
import type { JsonModel, JsonResult } from "../core/types";
import type { Host } from "../ui/host";
import { SAMPLES } from "../ui/samples";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Canned {
  name: string;
  description: string;
  labels: string[];
  flagLabels: string[];
  fine: string;
  first: [string, string][];
  repaired: [string, string][];
  diagnosis: string;
  tests: [string, string][];
}

const CANNED: Canned[] = [
  {
    name: "Commission-only jobs",
    description: "Flags job posts that hide a lack of guaranteed pay.",
    labels: ["paid", "commission only", "unpaid"],
    flagLabels: ["commission only", "unpaid"],
    fine: "paid",
    first: [["commission", "commission only"], ["unpaid", "unpaid"]],
    repaired: [["commission", "commission only"], ["unpaid", "unpaid"], ["uncapped", "commission only"], ["performance-based", "commission only"], ["certificate", "unpaid"], ["for exposure", "unpaid"], ["be your own boss", "commission only"]],
    diagnosis: "It only knew the words “commission” and “unpaid”. Added the euphemisms: uncapped earnings, performance-based pay, and pay in certificates or exposure.",
    tests: [
      ["Senior Accountant. $85k base, full benefits, 4 weeks PTO.", "paid"],
      ["Earn uncapped income selling solar. Top reps clear six figures!", "commission only"],
      ["Volunteer coordinator, unpaid, 10 hours a week.", "unpaid"],
      ["Pay is 100% commission, paid weekly on closed deals.", "commission only"],
      ["Barista, $17/hour plus tips, flexible shifts.", "paid"],
      ["Intern for exposure and a great portfolio piece.", "unpaid"],
      ["Be your own boss with our proven system. Starter kit $99.", "commission only"],
      ["Warehouse associate, $21/hr, overtime at time and a half.", "paid"],
      ["Interns receive a certificate of completion.", "unpaid"],
      ["Our reps earn commission on top of a $45k base salary.", "paid"],
      ["Compensation is performance-based on every account you sign.", "commission only"],
      ["Nurse, salaried, sign-on bonus $5,000.", "paid"],
    ],
  },
];

function cannedFor(intent: string): Canned {
  const i = SAMPLES.findIndex((s) => s.intent === intent);
  return CANNED[i] ?? CANNED[0];
}

const checklist = (c: Canned, rules: [string, string][]) =>
  `Decide whether the text matches: ${c.description}\n` +
  rules.map(([w, l], i) => `${i + 1}. Mentions "${w}" → ${l}`).join("\n") +
  `\nIf none apply → ${c.fine}.`;

class SimCloud implements JsonModel {
  private canned = CANNED[0];
  async generateJson(prompt: string): Promise<JsonResult> {
    await wait(1400);
    const intent = prompt.match(/Their words: """([\s\S]*?)"""/)?.[1];
    if (intent) {
      this.canned = cannedFor(intent);
      const c = this.canned;
      return {
        source: "in_cloud",
        raw: "",
        data: {
          name: c.name,
          description: c.description,
          labels: c.labels,
          flagLabels: c.flagLabels,
          systemPrompt: checklist(c, c.first),
          examples: [
            { input: "Salaried role with benefits.", label: c.fine, reason: "Pay is stated.", evidence: "Salaried" },
            { input: `Role is ${c.first[0][0]} based.`, label: c.first[0][1], reason: "No base pay.", evidence: c.first[0][0] },
          ],
          tests: c.tests.map(([input, expected]) => ({ input, expected, why: "" })),
        },
      };
    }
    const c = this.canned;
    return {
      source: "in_cloud",
      raw: "",
      data: {
        diagnosis: c.diagnosis,
        systemPrompt: checklist(c, c.repaired),
        examples: [
          { input: "Salaried role with benefits.", label: c.fine, reason: "Pay is stated.", evidence: "Salaried" },
          { input: "Uncapped earnings for top closers.", label: c.repaired[2][1], reason: "No guaranteed pay.", evidence: "Uncapped earnings" },
        ],
      },
    };
  }
}

class SimDevice implements JsonModel {
  async generateJson(prompt: string, schema: unknown): Promise<JsonResult> {
    await wait(260 + Math.random() * 240);
    const labels = (asRecord(asRecord(asRecord(schema).properties).label).enum as string[]) ?? [];
    const text = prompt.slice(prompt.lastIndexOf('Text: """') + 9).toLowerCase();
    const program = prompt.slice(0, prompt.indexOf("Examples:") > 0 ? prompt.indexOf("Examples:") : undefined);
    const base = program.match(/If none apply → ([\w ]+)\./)?.[1] ?? labels[0];
    // Salary beats every warning signal, the way a real checklist would read.
    if (/\$\d|salary|salaried|\/hour|\/hr/.test(text) && !/starter kit/.test(text)) {
      return { source: "on_device", raw: "", data: { label: base, reason: "It states guaranteed pay.", evidence: "" } };
    }
    for (const m of program.matchAll(/Mentions "(.+?)" → ([\w ]+)/g)) {
      const at = text.indexOf(m[1].toLowerCase());
      if (at >= 0) {
        return { source: "on_device", raw: "", data: { label: m[2], reason: `It says “${m[1]}” instead of stating pay.`, evidence: m[1] } };
      }
    }
    return { source: "on_device", raw: "", data: { label: base, reason: "Nothing suggests missing pay.", evidence: "" } };
  }
}

export function simulatedHost(): Omit<Host, "load" | "save"> {
  return {
    kind: "web",
    target: "gemini-nano",
    ready: true,
    simulated: true,
    cloud: new SimCloud(),
    device: new SimDevice(),
    maxRounds: 3,
    deviceState: async () => "available",
    prepareDevice: async () => {},
  };
}
