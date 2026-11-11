/**
 * Firebase setup shared by the web app and the Chrome extension.
 *
 * App Check is required by Firebase AI Logic. The web app uses reCAPTCHA
 * Enterprise when a site key is configured; local development and the
 * extension use an App Check debug token registered in the Firebase console.
 */
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { fetchAndActivate, getRemoteConfig, getValue } from "firebase/remote-config";
import { DEFAULT_COMPILER_MODEL } from "./ai";

export interface CantripEnv {
  firebase: FirebaseOptions | null;
  recaptchaKey?: string;
  appCheckDebugToken?: string;
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
    recaptchaKey: e.VITE_RECAPTCHA_ENTERPRISE_KEY || undefined,
    appCheckDebugToken: e.VITE_APPCHECK_DEBUG_TOKEN || undefined,
  };
}

export function startFirebase(env: CantripEnv): FirebaseApp {
  if (!env.firebase) throw new Error("Firebase is not configured. Copy .env.example to .env and fill it in.");
  const app = initializeApp(env.firebase);
  if (env.appCheckDebugToken) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.appCheckDebugToken;
  }
  if (env.recaptchaKey || env.appCheckDebugToken) {
    initializeAppCheck(app, {
      // A debug token always wins. Without a site key (the extension, local dev)
      // use a provider that loads no remote script, which extension pages forbid.
      provider: env.recaptchaKey
        ? new ReCaptchaEnterpriseProvider(env.recaptchaKey)
        : new CustomProvider({ getToken: () => Promise.reject(new Error("Register an App Check debug token for this build.")) }),
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
