import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("compiler model default", () => {
  const web = read("src/firebase/ai.ts").match(/DEFAULT_COMPILER_MODEL = "([^"]+)"/)?.[1];
  const ios = read("ios/Cantrip/Compiler.swift").match(/static let compilerModel = "([^"]+)"/)?.[1];

  it("is a model that answered on the free tier when checked", () => {
    // gemini-3.8-flash never answered through Firebase AI Logic on 14 Nov 2026; gemini-3.6-flash did.
    expect(web).toBe("gemini-3.6-flash");
  });

  it("is the same on iPhone, which has no Remote Config and no fallback", () => {
    expect(ios).toBe(web);
  });

  it("is what the README says", () => {
    expect(read("README.md")).toContain(`default \`${web}\``);
  });
});
