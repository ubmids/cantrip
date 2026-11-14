import "../ui/styles.css";
import { getAuth, signInAnonymously } from "firebase/auth/web-extension";
import { clip } from "../core/prompts";
import { runProgram } from "../core/run";
import type { Cantrip } from "../core/types";
import type { ScanReply, ToPage, ToPanel } from "../extension/protocol";
import { createModels, deviceState } from "../firebase/ai";
import { loadTuning, readEnv, startFirebase } from "../firebase/app";
import { appCheckProblem } from "../firebase/appcheck";
import { fetchShared, publishCantrip } from "../firebase/share";
import { mountApp } from "../ui/app";
import type { Host, PageBlockResult, PageScan } from "../ui/host";

const KEY = "cantrip.v1";

const store = {
  async load(): Promise<Cantrip[]> {
    const got = await chrome.storage.local.get(KEY);
    return (got[KEY] as Cantrip[]) ?? [];
  },
  async save(list: Cantrip[]) {
    await chrome.storage.local.set({ [KEY]: list });
  },
};

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

const toPage = <T>(tabId: number, msg: ToPage) => chrome.tabs.sendMessage(tabId, msg) as Promise<T>;

async function boot() {
  const root = document.getElementById("app")!;
  const env = readEnv();
  if (!env.firebase) {
    const { simulatedHost } = await import("./simulated");
    mountApp(root, { ...simulatedHost(), ...store, kind: "extension", simulated: false, ready: false, deviceState, setupProblem: "This build has no Firebase project yet. See the README to connect one." });
    return;
  }
  const app = startFirebase(env, "extension");
  const tuning = await loadTuning(app);
  const models = createModels(app, { compilerModel: tuning.compilerModel });
  const uid = async () => (getAuth(app).currentUser ?? (await signInAnonymously(getAuth(app))).user).uid;

  let lastTab: number | undefined;

  const host: Host = {
    kind: "extension",
    target: "gemini-nano",
    ready: true,
    setupProblem: appCheckProblem(env, "extension"),
    cloud: models.cloud,
    device: models.device,
    maxRounds: tuning.maxRounds,
    deviceState,
    prepareDevice: (p) => models.prepareDevice(p),
    ...store,
    share: async (c) => publishCantrip(app, c, await uid()),
    install: (code) => fetchShared(app, code, crypto.randomUUID()),
    page: {
      async scan(cantrips, onUpdate) {
        const tabId = await activeTabId();
        if (tabId == null) return;
        lastTab = tabId;
        let reply: ScanReply;
        try {
          reply = await toPage<ScanReply>(tabId, { type: "cantrip/scan" });
        } catch {
          onUpdate({ url: "", title: "", blocks: 0, results: [], running: false });
          throw new Error("Cantrip can't read this tab. Reload the page and try again.");
        }
        const scan: PageScan = { url: reply.url, title: reply.title, blocks: reply.blocks.length, results: [], running: true };
        onUpdate({ ...scan });
        // Every check runs on the device, one at a time: the page text never leaves this machine.
        for (const block of reply.blocks) {
          for (const c of cantrips) {
            const compiled = c.programs["gemini-nano"];
            if (!compiled) continue;
            const r: PageBlockResult = { key: block.key, cantripId: c.id, preview: clip(block.text, 160), text: block.text, verdict: null };
            try {
              r.verdict = await runProgram(models.device, c.spec, compiled.program, block.text);
              if (r.verdict.flagged) await toPage(tabId, { type: "cantrip/mark", key: block.key, name: c.spec.name, verdict: r.verdict });
            } catch (err) {
              r.error = (err as Error).message;
            }
            scan.results.push(r);
            onUpdate({ ...scan, results: [...scan.results] });
          }
        }
        scan.running = false;
        onUpdate({ ...scan, results: [...scan.results] });
      },
      reveal(key) {
        if (lastTab != null) toPage(lastTab, { type: "cantrip/reveal", key }).catch(() => {});
      },
    },
    onSelection(cb) {
      chrome.runtime.onMessage.addListener((msg: ToPanel) => {
        if (msg?.type === "cantrip/selection" && msg.text) cb(msg.text);
      });
    },
  };
  mountApp(root, host);
}

boot();
