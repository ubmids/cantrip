import { describe, expect, it } from "vitest";
import { withFallback } from "../src/core/fallback";
import type { JsonModel, JsonSchema } from "../src/core/types";

const schema: JsonSchema = { type: "object" };
const answers = (data: unknown): JsonModel => ({ generateJson: async () => ({ data, raw: "", source: "in_cloud" }) });
const fails = (message: string): JsonModel => ({ generateJson: async () => Promise.reject(new Error(message)) });
const hangs: JsonModel = { generateJson: () => new Promise(() => {}) };

describe("withFallback", () => {
  it("uses the first model when it answers", async () => {
    let fellBack = false;
    const m = withFallback(answers("first"), answers("second"), { onFallback: () => (fellBack = true) });
    expect((await m.generateJson("p", schema)).data).toBe("first");
    expect(fellBack).toBe(false);
  });

  it("uses the second model when the first is overloaded", async () => {
    const seen: string[] = [];
    const m = withFallback(fails("This model is currently experiencing high demand."), answers("second"), { onFallback: (e) => seen.push(e.message) });
    expect((await m.generateJson("p", schema)).data).toBe("second");
    expect(seen).toEqual(["This model is currently experiencing high demand."]);
  });

  it("uses the second model when the first hangs", async () => {
    const m = withFallback(hangs, answers("second"), { timeoutMs: 20 });
    expect((await m.generateJson("p", schema)).data).toBe("second");
  });

  it("reports the first model's error when both fail", async () => {
    const m = withFallback(fails("first broke"), fails("second broke"));
    await expect(m.generateJson("p", schema)).rejects.toThrow("first broke");
  });
});
