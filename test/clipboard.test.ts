import { describe, expect, it } from "vitest";
import { copyWithoutBlocking } from "../src/ui/clipboard";

describe("copyWithoutBlocking", () => {
  it("reports a copy that worked", async () => {
    expect(await copyWithoutBlocking(() => Promise.resolve())).toBe(true);
  });

  it("gives up on a clipboard that never answers, as Chrome's does in an unfocused page", async () => {
    expect(await copyWithoutBlocking(() => new Promise<void>(() => {}), 20)).toBe(false);
  });

  it("reports a refused copy without throwing", async () => {
    expect(await copyWithoutBlocking(() => Promise.reject(new Error("denied")))).toBe(false);
    expect(await copyWithoutBlocking(() => { throw new Error("no clipboard"); })).toBe(false);
  });

  it("copes with a browser that has no clipboard", async () => {
    expect(await copyWithoutBlocking(() => undefined)).toBe(false);
  });
});
