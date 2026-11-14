/**
 * Firebase setup shared by the web app and the Chrome extension.
 *
 * App Check is required by Firebase AI Logic. The hosted web app uses reCAPTCHA
 * (v3, or Enterprise if that is the key configured). Local development and the
 * extension use an App Check debug token registered in the Firebase console.
 */
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from "firebase/app-check";
import { fetchAndActivate, getRemoteConfig, getValue } from "firebase/remote-config";
import { DEFAULT_COMPILER_MODEL } from "./ai";
import { chooseAppCheck, type AppCheckEnv } from "./appcheck";

export interface CantripEnv extends AppCheckEnv {
  firebase: FirebaseOptions | null;
}

export function readEnv(): CantripEnv {
  const e = import.meta.env;
  const firebase =
    e.VITE_FIREBASE_API_KEY && e.VITE_FIREBASE_PROJECT_ID && e.VITE_FIREBASE_APP_ID
      ? {
          apiKey: e.VITE_FIREBASE_API_KEY,
          authDomain: e.VITE_FIREBASE_AUTH_DOMAIN || `${e.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
          projectId: e.VITE_FIREBASE_PROJECT_ID,
          appId: e.VITE_FIREBASE_APP_ID,
          storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
        }
      : null;
  return {
    firebase,
    recaptchaV3Key: e.VITE_RECAPTCHA_V3_KEY || undefined,
    recaptchaEnterpriseKey: e.VITE_RECAPTCHA_ENTERPRISE_KEY || undefined,
    appCheckDebugToken: e.VITE_APPCHECK_DEBUG_TOKEN || undefined,
  };
}

export function startFirebase(env: CantripEnv, host: "web" | "extension" = "web"): FirebaseApp {
  if (!env.firebase) throw new Error("Firebase is not configured. Copy .env.example to .env and fill it in.");
  const app = initializeApp(env.firebase);
  if (env.appCheckDebugToken) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken;
  }
  const choice = chooseAppCheck(env, host);
  if (choice.kind !== "none") {
    initializeAppCheck(app, {
      provider:
        choice.kind === "recaptcha-v3"
          ? new ReCaptchaV3Provider(choice.siteKey)
          : choice.kind === "recaptcha-enterprise"
            ? new ReCaptchaEnterpriseProvider(choice.siteKey)
            : // Debug token only: a provider that loads no remote script, which extension pages forbid.
              new CustomProvider({ getToken: () => Promise.reject(new Error("Register an App Check debug token for this build.")) }),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return app;
}

export interface Tuning {
  compilerModel: string;
  maxRounds: number;
}

/** Compiler settings live in Remote Config, so the model can change without shipping a new build. */
export async function loadTuning(app: FirebaseApp): Promise<Tuning> {
  const fallback: Tuning = { compilerModel: DEFAULT_COMPILER_MODEL, maxRounds: 4 };
  try {
    const rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
    rc.defaultConfig = { compiler_model: fallback.compilerModel, max_rounds: fallback.maxRounds };
    await Promise.race([fetchAndActivate(rc), new Promise((r) => setTimeout(r, 2500))]);
    const rounds = getValue(rc, "max_rounds").asNumber();
    return {
      compilerModel: getValue(rc, "compiler_model").asString() || fallback.compilerModel,
      maxRounds: rounds >= 1 && rounds <= 6 ? rounds : fallback.maxRounds,
    };
  } catch {
    return fallback;
  }
}
