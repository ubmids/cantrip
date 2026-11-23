/**
 * The only place Cantrip talks to a model. Every call goes through Firebase
 * AI Logic:
 *
 *  - the compiler runs in the cloud (InferenceMode.ONLY_IN_CLOUD);
 *  - compiled programs run on the device (InferenceMode.ONLY_ON_DEVICE), so the
 *    text you read never leaves your machine. Compile tests and the extension's
 *    page reading only ever use this one: they fail closed;
 *  - in the web app, a person on a browser without a local model can still run
 *    a ready cantrip on text they paste or pick (InferenceMode.PREFER_ON_DEVICE):
 *    Firebase AI Logic uses Gemini Nano when Chrome has it, and Gemini in the
 *    cloud when it doesn't. The app says so before the run, caps those cloud
 *    runs per session, and every verdict shows response.inferenceSource.
 */
import type { FirebaseApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import { withFallback } from "../core/fallback";
import { parseJsonLoose } from "../core/json";
import type { JsonModel, JsonResult, JsonSchema, Source } from "../core/types";

export const DEFAULT_COMPILER_MODEL = "gemini-3.6-flash";
export const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";
/** The cloud side of hybrid runs, for browsers without Gemini Nano. Light, because it only labels one text. */
export const DEFAULT_CLOUD_CHECK_MODEL = DEFAULT_FALLBACK_MODEL;
/** How long the compiler waits for the first cloud model before trying the lighter one. */
export const CLOUD_TIMEOUT_MS = 45_000;

const ON_DEVICE_IO = {
  expectedInputs: [{ type: "text" as const, languages: ["en"] }],
  expectedOutputs: [{ type: "text" as const, languages: ["en"] }],
};

function toSource(s: unknown): Source | null {
  return s === "on_device" ? "on_device" : s === "in_cloud" ? "in_cloud" : null;
}

class FirebaseJsonModel implements JsonModel {
  private cache = new Map<string, GenerativeModel>();
  constructor(private make: (schema: JsonSchema) => GenerativeModel) {}

  model(schema: JsonSchema): GenerativeModel {
    const key = JSON.stringify(schema);
    let m = this.cache.get(key);
    if (!m) {
      m = this.make(schema);
      this.cache.set(key, m);
    }
    return m;
  }

  async generateJson(prompt: string, schema: JsonSchema): Promise<JsonResult> {
    const result = await this.model(schema).generateContent(prompt);
    const raw = result.response.text();
    return { data: parseJsonLoose(raw), raw, source: toSource(result.response.inferenceSource) };
  }
}

export interface Models {
  ai: AI;
  /** The compiler: a strong cloud model. */
  cloud: JsonModel;
  /** The runtime: the on-device model. Never falls back to the cloud. */
  device: JsonModel;
  /** Hybrid runtime: Gemini Nano when this browser has it, otherwise Gemini in the cloud. */
  hybrid: JsonModel;
  /** Starts the one-time on-device model download. Must run inside a click handler. */
  prepareDevice(onProgress?: (fraction: number) => void): Promise<void>;
}

export interface ModelOptions {
  compilerModel?: string;
  /** The cloud model the hybrid runtime falls back to. */
  cloudCheckModel?: string;
}

export function createModels(app: FirebaseApp, opts: ModelOptions = {}): Models {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const compilerModel = opts.compilerModel || DEFAULT_COMPILER_MODEL;

  const cloudModel = (model: string) =>
    new FirebaseJsonModel((schema) =>
      getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model,
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: schema as never,
          },
        },
      }),
    );
  // A free tier model is sometimes overloaded (gemini-3.8-flash was on 14 Nov 2026): it hangs for a minute, then
  // fails. The compiler then falls back to the lighter model rather than leaving the person stuck.
  const cloud: JsonModel =
    compilerModel === DEFAULT_FALLBACK_MODEL
      ? cloudModel(compilerModel)
      : withFallback(cloudModel(compilerModel), cloudModel(DEFAULT_FALLBACK_MODEL), {
          timeoutMs: CLOUD_TIMEOUT_MS,
          onFallback: (e) => console.warn(`Cantrip: ${compilerModel} failed (${e.message}). Using ${DEFAULT_FALLBACK_MODEL}.`),
        });

  const device = new FirebaseJsonModel((schema) =>
    getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: ON_DEVICE_IO as never,
        promptOptions: { responseConstraint: schema },
      },
    }),
  );

  // Hybrid inference: the SDK checks Chrome's LanguageModel first and only goes to the cloud when the
  // on-device model is not available. It never starts the model download on its own in this mode.
  const hybrid = new FirebaseJsonModel((schema) =>
    getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      onDeviceParams: {
        createOptions: ON_DEVICE_IO as never,
        promptOptions: { responseConstraint: schema },
      },
      inCloudParams: {
        model: opts.cloudCheckModel || DEFAULT_CLOUD_CHECK_MODEL,
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema as never },
      },
    }),
  );

  return {
    ai,
    cloud,
    device,
    hybrid,
    async prepareDevice(onProgress) {
      const probe = getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_ON_DEVICE,
        onDeviceParams: { createOptions: ON_DEVICE_IO as never },
      });
      await probe.initializeDeviceModel(onProgress);
    },
  };
}

export type DeviceState = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";

/** Ask Chrome whether its built-in model is ready, without starting a download. */
export async function deviceState(): Promise<DeviceState> {
  const LM = (globalThis as { LanguageModel?: { availability(o?: unknown): Promise<string> } }).LanguageModel;
  if (!LM) return "unsupported";
  try {
    const s = await LM.availability(ON_DEVICE_IO);
    return (["available", "downloadable", "downloading", "unavailable"].includes(s) ? s : "unavailable") as DeviceState;
  } catch {
    return "unavailable";
  }
}
