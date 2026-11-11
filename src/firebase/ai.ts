/**
 * The only place Cantrip talks to a model. Every call goes through Firebase
 * AI Logic:
 *
 *  - the compiler runs in the cloud (InferenceMode.ONLY_IN_CLOUD);
 *  - compiled programs run on the device (InferenceMode.ONLY_ON_DEVICE), so the
 *    text you read never leaves your machine. If you allow it, a device without
 *    a local model can fall back to the cloud (PREFER_ON_DEVICE), and every
 *    verdict says where it ran.
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
import { parseJsonLoose } from "../core/json";
import type { JsonModel, JsonResult, JsonSchema, Source } from "../core/types";

export const DEFAULT_COMPILER_MODEL = "gemini-3.8-flash";
export const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

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
  /** The runtime: the on-device model. */
  device: JsonModel;
  /** Starts the one-time on-device model download. Must run inside a click handler. */
  prepareDevice(onProgress?: (fraction: number) => void): Promise<void>;
}

export interface ModelOptions {
  compilerModel?: string;
  /** Allow verdicts to fall back to the cloud when this device has no local model. Off by default. */
  allowCloudFallback?: boolean;
}

export function createModels(app: FirebaseApp, opts: ModelOptions = {}): Models {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const compilerModel = opts.compilerModel || DEFAULT_COMPILER_MODEL;

  const cloud = new FirebaseJsonModel((schema) =>
    getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: compilerModel,
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: schema as never,
        },
      },
    }),
  );

  const device = new FirebaseJsonModel((schema) =>
    getGenerativeModel(ai, {
      mode: opts.allowCloudFallback ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: ON_DEVICE_IO as never,
        promptOptions: { responseConstraint: schema },
      },
      inCloudParams: {
        model: DEFAULT_FALLBACK_MODEL,
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema as never },
      },
    }),
  );

  return {
    ai,
    cloud,
    device,
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
