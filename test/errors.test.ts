import { describe, expect, it } from "vitest";
import { explainError, friendlyError } from "../src/core/errors";

const THROTTLED = new Error("AppCheck: Requests throttled due to previous 403 error. Attempts allowed again after 01d:00m:00s (appCheck/throttled).");
const AI_401 = new Error(
  "AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/p/models/gemini-3.5-flash-lite:generateContent: [401 ] Firebase App Check token is invalid. (AI/fetch-error)",
);

describe("explainError on an App Check refusal", () => {
  it("explains a throttle in words, never says to reload, and keeps the SDK's code apart", () => {
    const e = explainError(THROTTLED, { cloudCheck: true });
    expect(e.message).toMatch(/^Firebase App Check turned this browser away earlier/);
    expect(e.message).toContain("Reloading will not help");
    expect(e.message).toContain("another normal browser window");
    expect(e.message).toContain("watch the demo video");
    expect(e.message).not.toMatch(/reload the page|try again/i);
    expect(e.message).not.toContain("appCheck/throttled");
    expect(e.details).toContain("appCheck/throttled");
    expect(e.retry).toBe(false);
    expect(e.refused).toBe(true);
  });

  it("treats the 401 Firebase AI Logic gives a refused browser as a refusal, and hides the raw text", () => {
    const e = explainError(AI_401, { cloudCheck: true });
    expect(e.message).toMatch(/^Firebase App Check could not confirm this browser, so the cloud check was refused\./);
    expect(e.message).not.toContain("[401");
    expect(e.message).not.toContain("AI/fetch-error");
    expect(e.details).toContain("[401 ] Firebase App Check token is invalid. (AI/fetch-error)");
    expect(e.details).not.toContain("https://");
    expect(e.retry).toBe(false);
  });

  it("treats a bare 403 from the cloud as a refusal too", () => {
    const e = explainError(new Error("AI: Error fetching from https://x/y: [403 ] Forbidden (AI/fetch-error)"), { cloudCheck: true });
    expect(e.refused).toBe(true);
    expect(e.message).not.toContain("Forbidden");
  });

  it("names the compiler's call, not a cloud check, when a compile is refused", () => {
    expect(explainError(new Error("FirebaseError: AppCheck: 403 error (appCheck/fetch-status-error).")).message).toMatch(
      /^Firebase App Check could not confirm this browser, so the call to Gemini was refused\./,
    );
  });

  it("lets a retry happen for errors a retry can clear", () => {
    expect(explainError(new Error("[429 ] quota"), { cloudCheck: true }).retry).toBe(true);
    expect(explainError(new TypeError("Failed to fetch"), { cloudCheck: true }).retry).toBe(true);
  });
});

describe("friendlyError", () => {
  it("explains an App Check throttle instead of leading with the SDK's code", () => {
    const m = friendlyError(THROTTLED);
    expect(m).toMatch(/^Firebase App Check turned this browser away/);
    expect(m).not.toMatch(/reload the page/i);
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

  it("leaves request URLs out of the message, so it fits on a phone", () => {
    const m = friendlyError(new Error("AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/x/models/y:generateContent: [429 ] quota"));
    expect(m).toMatch(/busy or out of free quota/);
    expect(m).not.toContain("https://");
  });

  it("keeps the original message short", () => {
    const m = friendlyError(new Error("Failed to fetch " + "x".repeat(500)));
    expect(m.length).toBeLessThan(300);
  });
});
