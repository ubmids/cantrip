import { describe, expect, it } from "vitest";
import { friendlyError } from "../src/core/errors";

describe("friendlyError", () => {
  it("explains an App Check throttle instead of showing the SDK's code", () => {
    const m = friendlyError(new Error("AppCheck: Requests throttled due to previous 403 error. Attempts allowed again after 01d:00m:00s (appCheck/throttled)."));
    expect(m).toMatch(/^Firebase App Check turned this browser away/);
    expect(m).toContain("appCheck/throttled");
  });

  it("explains other App Check refusals", () => {
    expect(friendlyError(new Error("FirebaseError: AppCheck: 403 error (appCheck/fetch-status-error)."))).toMatch(/^Firebase App Check could not confirm/);
  });

  it("says a dropped connection only matters for compiling", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toMatch(/^Compiling needs the internet/);
  });

  it("says a dropped connection stopped a cloud check, when the check went to the cloud", () => {
    const m = friendlyError(new TypeError("Failed to fetch"), { cloudCheck: true });
    expect(m).toMatch(/^This browser has no on-device model, so this check runs in the cloud/);
    expect(m).not.toContain("Compiling");
  });

  it("explains quota and overload errors", () => {
    expect(friendlyError(new Error("[429 ] Resource has been exhausted (e.g. check quota)."))).toMatch(/busy or out of free quota/);
  });

  it("explains a cloud timeout", () => {
    expect(friendlyError(new Error("The model did not answer within 45 seconds."))).toMatch(/took too long/);
  });

  it("explains an on-device answer outside the labels", () => {
    expect(friendlyError(new Error("Device answered with a label outside the program: maybe"))).toMatch(/not deterministic/);
  });

  it("reports a stop as a stop", () => {
    expect(friendlyError(new DOMException("Compile cancelled", "AbortError"))).toBe("Stopped.");
  });

  it("passes anything else through unchanged", () => {
    expect(friendlyError(new Error("The compiler returned too few usable tests."))).toBe("The compiler returned too few usable tests.");
    expect(friendlyError("plain")).toBe("plain");
    expect(friendlyError(undefined)).toBe("Something went wrong.");
  });

  it("keeps the original message short", () => {
    const m = friendlyError(new Error("Failed to fetch " + "x".repeat(500)));
    expect(m.length).toBeLessThan(300);
  });
});
