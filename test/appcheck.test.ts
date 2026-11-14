import { describe, expect, it } from "vitest";
import { appCheckProblem, chooseAppCheck } from "../src/firebase/appcheck";

describe("chooseAppCheck", () => {
  it("uses reCAPTCHA v3 on the hosted web app when a v3 key is set", () => {
    expect(chooseAppCheck({ recaptchaV3Key: "site" }, "web")).toEqual({ kind: "recaptcha-v3", siteKey: "site" });
  });

  it("prefers v3 over Enterprise when both keys are set", () => {
    expect(chooseAppCheck({ recaptchaV3Key: "v3", recaptchaEnterpriseKey: "ent" }, "web").kind).toBe("recaptcha-v3");
  });

  it("still supports an Enterprise key on its own", () => {
    expect(chooseAppCheck({ recaptchaEnterpriseKey: "ent" }, "web")).toEqual({ kind: "recaptcha-enterprise", siteKey: "ent" });
  });

  it("never uses reCAPTCHA in the extension, which may not load remote scripts", () => {
    expect(chooseAppCheck({ recaptchaV3Key: "v3", appCheckDebugToken: "t" }, "extension")).toEqual({ kind: "debug-only" });
    expect(chooseAppCheck({ recaptchaV3Key: "v3" }, "extension")).toEqual({ kind: "none" });
  });

  it("falls back to the debug token for local development", () => {
    expect(chooseAppCheck({ appCheckDebugToken: "t" }, "web")).toEqual({ kind: "debug-only" });
  });
});

describe("appCheckProblem", () => {
  it("says nothing when the build can pass App Check", () => {
    expect(appCheckProblem({ recaptchaV3Key: "site" }, "web")).toBeUndefined();
    expect(appCheckProblem({ appCheckDebugToken: "t" }, "extension")).toBeUndefined();
  });

  it("warns when a build has no way to pass App Check", () => {
    expect(appCheckProblem({}, "web")).toMatch(/reCAPTCHA site key/);
    expect(appCheckProblem({ recaptchaV3Key: "site" }, "extension")).toMatch(/debug token/);
  });
});
