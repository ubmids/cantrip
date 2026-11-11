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
  device: JsonModel;
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
