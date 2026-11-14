import "../ui/styles.css";
import { getAuth, signInAnonymously } from "firebase/auth";
import { createModels, deviceState } from "../firebase/ai";
import { loadTuning, readEnv, startFirebase } from "../firebase/app";
import { fetchShared, publishCantrip } from "../firebase/share";
import type { Cantrip } from "../core/types";
import { mountApp } from "../ui/app";
import type { Host } from "../ui/host";

const KEY = "cantrip.v1";

const localStore = {
  async load(): Promise<Cantrip[]> {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      return [];
    }
  },
  async save(list: Cantrip[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // Private windows can refuse storage; the session still works.
    }
  },
};

const newId = () => crypto.randomUUID();

async function boot() {
  const root = document.getElementById("app")!;

  if (import.meta.env.VITE_SIMULATE === "1") {
    const { simulatedHost } = await import("./simulated");
    mountApp(root, { ...simulatedHost(), ...localStore });
    return;
  }

  const env = readEnv();
  if (!env.firebase) {
    const { simulatedHost } = await import("./simulated");
    mountApp(root, {
      ...simulatedHost(),
      ...localStore,
      simulated: false,
      ready: false,
      deviceState,
      setupProblem: "This build has no Firebase project yet. See the README to connect one.",
    });
    return;
  }

  const app = startFirebase(env);
  const tuning = await loadTuning(app);
  const models = createModels(app, { compilerModel: tuning.compilerModel });
  const uid = async () => (getAuth(app).currentUser ?? (await signInAnonymously(getAuth(app))).user).uid;

  const host: Host = {
    kind: "web",
    target: "gemini-nano",
    ready: true,
    cloud: models.cloud,
    device: models.device,
    maxRounds: tuning.maxRounds,
    deviceState,
    prepareDevice: (p) => models.prepareDevice(p),
    ...localStore,
    share: async (c) => publishCantrip(app, c, await uid()),
    install: (code) => fetchShared(app, code, newId()),
  };
  mountApp(root, host);
}

boot();
