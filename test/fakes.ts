import type { JsonModel, JsonResult, JsonSchema } from "../src/core/types";

/**
 * A fake on-device model with deliberately limited ability: it only notices a
 * signal word if the program's prompt teaches it ("signal: <word> -> <label>").
 * That makes the repair loop observable: better prompts really do score better.
 */
export class FakeDevice implements JsonModel {
  calls: string[] = [];
  constructor(private fallbackLabel = "fine") {}
  async generateJson(prompt: string): Promise<JsonResult> {
    this.calls.push(prompt);
    const [program, rest] = splitPrompt(prompt);
    const input = rest.toLowerCase();
    const rules = [...program.matchAll(/signal: (\w[\w ]*?) -> (\w[\w ]*)/g)].map((m) => [m[1].toLowerCase(), m[2]]);
    for (const [word, label] of rules) {
      const at = input.indexOf(word);
      if (at >= 0) {
        const quote = rest.slice(at, at + word.length);
        return { data: { label, reason: `It mentions ${word}.`, evidence: quote }, raw: "", source: "on_device" };
      }
    }
    return { data: { label: this.fallbackLabel, reason: "Nothing stood out.", evidence: "" }, raw: "", source: "on_device" };
  }
}

function splitPrompt(prompt: string): [string, string] {
  const marker = "Now answer for this text.";
  const i = prompt.lastIndexOf(marker);
  const program = prompt.slice(0, prompt.indexOf("Examples:") >= 0 ? prompt.indexOf("Examples:") : i);
  const m = prompt.slice(i).match(/Text: """([\s\S]*)"""/);
  return [program, m ? m[1] : ""];
}

/** A scripted cloud compiler: returns queued responses in order and records prompts. */
export class ScriptedCloud implements JsonModel {
  prompts: string[] = [];
  schemas: JsonSchema[] = [];
  constructor(private queue: unknown[]) {}
  async generateJson(prompt: string, schema: JsonSchema): Promise<JsonResult> {
    this.prompts.push(prompt);
    this.schemas.push(schema);
    if (!this.queue.length) throw new Error("ScriptedCloud ran out of responses");
    return { data: this.queue.shift(), raw: "", source: "in_cloud" };
  }
}

export function counterIds() {
  let n = 0;
  return () => `id${++n}`;
}
