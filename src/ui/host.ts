import type { CloudBudget } from "../core/budget";
import type { Cantrip, JsonModel, Target, Verdict } from "../core/types";
import type { DeviceState } from "../firebase/ai";

export interface PageBlockResult {
  key: string;
  cantripId: string;
  preview: string;
  text: string;
  verdict: Verdict | null;
  error?: string;
}

export interface PageScan {
  url: string;
  title: string;
  blocks: number;
  results: PageBlockResult[];
  running: boolean;
}

/** What the UI needs from wherever it is running: the web app, or the extension's side panel. */
export interface Host {
  kind: "web" | "extension";
  target: Target;
  ready: boolean;
  /** Why the models are not available, when they are not. */
  setupProblem?: string;
  /** Shown as a banner when the models are simulated (preview builds only). */
  simulated?: boolean;
  cloud: JsonModel;
  /** On the device only. Compiling and page reading use this, so they fail closed. */
  device: JsonModel;
  /**
   * Web app only: Gemini Nano when the browser has it, Gemini in the cloud when it doesn't
   * (Firebase AI Logic's PREFER_ON_DEVICE). Used to run a ready cantrip on text the person
   * picked or pasted, after the app has said the text will go to the cloud.
   */
  hybrid?: JsonModel;
  /** Caps the cloud runs of `hybrid` per session. */
  cloudBudget?: CloudBudget;
  maxRounds: number;
  deviceState(): Promise<DeviceState>;
  prepareDevice(onProgress: (f: number) => void): Promise<void>;
  load(): Promise<Cantrip[]>;
  save(list: Cantrip[]): Promise<void>;
  share?(c: Cantrip): Promise<string>;
  install?(code: string): Promise<Cantrip | null>;
  /** Extension only: run enabled cantrips on the open tab. */
  page?: {
    scan(cantrips: Cantrip[], onUpdate: (s: PageScan) => void): Promise<void>;
    reveal(key: string): void;
  };
  /** Extension only: text the person sent from a page with the context menu. */
  onSelection?(cb: (text: string) => void): void;
}
