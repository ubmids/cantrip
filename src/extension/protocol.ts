/** Messages between the side panel (where the models run) and the page. */
import type { Verdict } from "../core/types";

export type ToPage =
  | { type: "cantrip/scan" }
  | { type: "cantrip/mark"; key: string; name: string; verdict: Verdict }
  | { type: "cantrip/clear" }
  | { type: "cantrip/reveal"; key: string };

export interface ScanReply {
  url: string;
  title: string;
  blocks: { key: string; text: string }[];
}

export type ToPanel = { type: "cantrip/selection"; text: string };
