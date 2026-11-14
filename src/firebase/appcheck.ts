/**
 * Which App Check provider a build uses. Kept free of Firebase imports so it can be tested.
 *
 * - The hosted web app attests with reCAPTCHA: v3 when a v3 site key is set, Enterprise when
 *   only an Enterprise key is set.
 * - The Chrome extension never uses reCAPTCHA, because extension pages may not load remote
 *   scripts. It relies on a registered debug token.
 * - Local development uses a debug token. The Firebase SDK lets a debug token win over any
 *   provider, so a hosted build must be made with the debug token empty.
 */
export interface AppCheckEnv {
  recaptchaV3Key?: string;
  recaptchaEnterpriseKey?: string;
  appCheckDebugToken?: string;
}

export type AppCheckChoice =
  | { kind: "recaptcha-v3"; siteKey: string }
  | { kind: "recaptcha-enterprise"; siteKey: string }
  | { kind: "debug-only" }
  | { kind: "none" };

export function chooseAppCheck(env: AppCheckEnv, host: "web" | "extension"): AppCheckChoice {
  if (host === "web") {
    if (env.recaptchaV3Key) return { kind: "recaptcha-v3", siteKey: env.recaptchaV3Key };
    if (env.recaptchaEnterpriseKey) return { kind: "recaptcha-enterprise", siteKey: env.recaptchaEnterpriseKey };
  }
  return env.appCheckDebugToken ? { kind: "debug-only" } : { kind: "none" };
}

/** Why Gemini calls will be refused, when this build has no way to pass App Check. */
export function appCheckProblem(env: AppCheckEnv, host: "web" | "extension"): string | undefined {
  if (chooseAppCheck(env, host).kind !== "none") return undefined;
  return host === "extension"
    ? "This build has no App Check debug token, so Firebase will refuse its Gemini calls. See the README."
    : "This build has no reCAPTCHA site key or App Check debug token, so Firebase will refuse its Gemini calls. See the README.";
}
