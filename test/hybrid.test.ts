// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudBudget, type CloudBudget } from "../src/core/budget";
import type { Cantrip, JsonModel, JsonResult } from "../src/core/types";
import type { DeviceState } from "../src/firebase/ai";
import { mountApp } from "../src/ui/app";
import type { Host } from "../src/ui/host";
import { SAMPLES } from "../src/ui/samples";
import { BOARD_POSTS, hiddenPayCheck, STARTER_ID, withCurrentStarterName } from "../src/ui/starter";
import real from "../src/ui/starter/job-shield-14nov.json";

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
});

/** Labels like the Hidden-pay check would, and records every call. */
class LabelModel implements JsonModel {
  calls = 0;
  constructor(private source: "on_device" | "in_cloud") {}
  async generateJson(prompt: string): Promise<JsonResult> {
    this.calls++;
    const text = prompt.slice(prompt.lastIndexOf('Text: """')).toLowerCase();
    const label = text.includes("unpaid") ? "unpaid job" : /performance-based|no base pay/.test(text) ? "commission only" : "standard pay";
    const evidence = label === "unpaid job" ? "unpaid" : label === "commission only" ? (text.includes("no base pay") ? "no base pay" : "performance-based") : "";
    return { data: { label, reason: "Fake.", evidence }, raw: "", source: this.source };
  }
}

class Untouchable implements JsonModel {
  async generateJson(): Promise<JsonResult> {
    throw new Error("This model must not be called here.");
  }
}

function mount(opts: { device: DeviceState; deviceModel?: JsonModel; hybrid?: JsonModel; budget?: CloudBudget }) {
  let list: Cantrip[] = [];
  const root = document.createElement("div");
  document.body.append(root);
  const host: Host = {
    kind: "web",
    target: "gemini-nano",
    ready: true,
    cloud: new Untouchable(),
    device: opts.deviceModel ?? new Untouchable(),
    hybrid: opts.hybrid,
    cloudBudget: opts.budget,
    maxRounds: 2,
    deviceState: async () => opts.device,
    prepareDevice: async () => {},
    load: async () => list,
    save: async (l) => void (list = l),
  };
  mountApp(root, host);
  return { root, saved: () => list };
}

const flat = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

const button = (root: HTMLElement, text: RegExp) =>
  [...root.querySelectorAll("button")].find((b) => text.test(b.textContent ?? "")) as HTMLButtonElement | undefined;

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("cloud check budget", () => {
  it("allows a fixed number of cloud checks, then refuses", () => {
    const b = cloudBudget(2, memoryStore());
    expect(b.left()).toBe(2);
    expect(b.take()).toBe(true);
    expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
    expect(b.left()).toBe(0);
  });

  it("keeps the count across page loads in the same session", () => {
    const store = memoryStore();
    cloudBudget(3, store).take();
    expect(cloudBudget(3, store).left()).toBe(2);
  });

  it("still caps when storage throws, as it can in a private window", () => {
    const b = cloudBudget(1, {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
  });

  it("can be turned off with a cap of zero", () => {
    expect(cloudBudget(0, memoryStore()).take()).toBe(false);
  });
});

describe("the Hidden-pay check starter", () => {
  const shield = hiddenPayCheck(1);

  it("is the program compiled on Gemini Nano on 14 November, unchanged", () => {
    const original = real.cantrip as unknown as Cantrip;
    expect(shield.programs["gemini-nano"]).toEqual(original.programs["gemini-nano"]);
    expect(shield.tests).toEqual(original.tests);
    expect(shield.spec.labels).toEqual(original.spec.labels);
    expect(shield.spec.flagLabels).toEqual(original.spec.flagLabels);
  });

  it("carries the scores the README reports for that run", () => {
    const p = shield.programs["gemini-nano"]!;
    expect(p.tuneAccuracy).toBe(1);
    expect(p.holdoutAccuracy).toBe(1);
    expect(p.cloudCalls).toBe(1);
    expect(p.deviceCalls).toBe(12);
    expect(p.rounds[0].results.filter((r) => r.ok)).toHaveLength(9);
    expect(p.holdoutResults.filter((r) => r.ok)).toHaveLength(3);
    expect([...p.rounds[0].results, ...p.holdoutResults].every((r) => r.source === "on_device")).toBe(true);
    expect(new Date(p.compiledAt).toISOString().slice(0, 10)).toBe("2026-11-14");
    expect(shield.provenance).toContain("14 November 2026");
  });

  it("keeps the sample's words, so its examples show up, and has no share code to overwrite", () => {
    expect(shield.spec.intent).toBe(SAMPLES[0].intent);
    expect(shield.id).toBe(STARTER_ID);
    expect(shield.shareCode).toBeUndefined();
  });

  it("is named for what it checks, and renames a copy saved under its old name", () => {
    expect(shield.spec.name).toBe("Hidden-pay check");
    expect(shield.spec.description).toMatch(/no guaranteed pay/);
    const old = { ...shield, spec: { ...shield.spec, name: "Job-scam shield" } };
    expect(withCurrentStarterName(old).spec.name).toBe("Hidden-pay check");
    expect(withCurrentStarterName(old).programs).toEqual(shield.programs);
    const other = { ...old, id: "someone-elses" };
    expect(withCurrentStarterName(other)).toBe(other);
  });

  it("checks posts copied word for word from the demo job board", () => {
    const page = readFileSync(resolve(process.cwd(), "demo/jobs.html"), "utf8").replace(/&amp;/g, "&");
    for (const p of BOARD_POSTS) {
      expect(page).toContain(p.title);
      expect(page).toContain(p.body);
    }
  });
});

describe("hybrid runs in the web app", () => {
  it("opens on the job seeker's problem, with one thing to do", async () => {
    const { root } = mount({ device: "unsupported", hybrid: new LabelModel("in_cloud"), budget: cloudBudget(5, memoryStore()) });
    await vi.waitFor(() => expect(root.querySelector(".pill")?.textContent).toContain("cloud fallback"));
    expect(root.querySelector("h1")?.textContent).toMatch(/job posts/);
    expect(root.querySelector(".eyebrow")?.textContent).toMatch(/job seekers/i);
    // One primary button on the front page, the five ads, and the composer kept off it.
    expect([...root.querySelectorAll("main .btn.primary")].map((b) => flat(b))).toEqual(["Check these 5 posts"]);
    expect(root.querySelectorAll(".board .post")).toHaveLength(BOARD_POSTS.length);
    expect(root.querySelector("#intent")).toBeNull();
    expect(root.querySelector(".library")).toBeNull();
    expect(flat(root.querySelector(".band"))).toContain("Make your own check");
    expect(flat(root.querySelector("footer .also"))).toContain("Chrome extension that does this on any job board");
  });

  it("keeps the composer and the library on their own screens, with Back to the front page", async () => {
    const { root } = mount({ device: "unsupported", hybrid: new LabelModel("in_cloud"), budget: cloudBudget(5, memoryStore()) });
    await vi.waitFor(() => expect(flat(root.querySelector(".checks-link"))).toBe("Your checks (0)"));

    (root.querySelector(".band a") as HTMLAnchorElement).click();
    expect(location.hash).toBe("#make");
    expect(flat(root.querySelector("h1"))).toBe("Make your own check");
    expect(root.querySelector("#intent")).not.toBeNull();
    expect(root.querySelectorAll(".chip").length).toBe(SAMPLES.length);
    expect(root.querySelector(".board")).toBeNull();
    expect(flat(root.querySelector("#compose .notice"))).toContain("on the front page still runs, in the cloud");

    button(root, /Back to the ads/)!.click();
    expect(location.hash).toBe("");
    expect(root.querySelector(".board")).not.toBeNull();
    expect(root.querySelector("#intent")).toBeNull();

    // The browser's Back button returns to the screen it left.
    (root.querySelector(".checks-link") as HTMLAnchorElement).click();
    expect(flat(root.querySelector(".library h2"))).toBe("Your checks");
    history.replaceState(null, "", "#make");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(root.querySelector("#intent")).not.toBeNull();
  });

  it("opens on the composer when the address asks for it", async () => {
    history.replaceState(null, "", "#make");
    const { root } = mount({ device: "available", deviceModel: new LabelModel("on_device") });
    expect(flat(root.querySelector("h1"))).toBe("Make your own check");
  });

  it("counts the checks in the library, and opens one from there", async () => {
    const device = new LabelModel("on_device");
    const { root } = mount({ device: "available", deviceModel: device });
    await vi.waitFor(() => expect(flat(root.querySelector(".proof"))).toContain("Nothing sent"));
    button(root, /Check these 5 posts/)!.click();
    await vi.waitFor(() => expect(root.querySelector(".summary")).not.toBeNull());
    expect(flat(root.querySelector(".checks-link"))).toBe("Your checks (1)");

    (root.querySelector(".checks-link") as HTMLAnchorElement).click();
    expect(flat(root.querySelector(".list"))).toContain("Hidden-pay check");
    (root.querySelector(".list .item") as HTMLButtonElement).click();
    expect(flat(root.querySelector(".detail h2"))).toBe("Hidden-pay check");
    button(root, /Your checks/)!.click();
    expect(root.querySelector(".list")).not.toBeNull();
  });

  it("without Gemini Nano, says the posts will go to the cloud, runs them there, labels each result, and stops at the cap", async () => {
    const hybrid = new LabelModel("in_cloud");
    const budget = cloudBudget(3, memoryStore());
    const { root, saved } = mount({ device: "unsupported", hybrid, budget });
    // Before anything is sent: the chips say where it runs and the cap, and one line says the posts go to the cloud.
    await vi.waitFor(() => expect(flat(root.querySelector(".hero .where"))).toContain("send these posts to Gemini in the cloud"));
    expect(flat(root.querySelector(".proof"))).toContain("Runs in the cloud here");
    expect(flat(root.querySelector(".proof"))).toContain("3 checks left");

    button(root, /Check these 5 posts/)!.click();
    await vi.waitFor(() => expect(root.querySelector(".summary")).not.toBeNull());

    expect(hybrid.calls).toBe(3);
    const sources = [...root.querySelectorAll(".board .src")].map((e) => e.textContent);
    expect(sources).toHaveLength(3);
    expect(sources.every((t) => t?.includes("ran in the cloud: no on-device model here"))).toBe(true);
    expect(root.querySelector(".board .badge")?.textContent).toContain("commission only");
    expect(flat(root.querySelector(".where.limit"))).toContain("free Gemini tier");
    expect(flat(root.querySelector(".proof"))).toBe("No cloud checks left this visit");
    expect(flat(root.querySelector(".summary"))).toContain("2 not checked");
    expect(button(root, /Check again/)!.disabled).toBe(true);
    expect(saved().map((c) => c.id)).toEqual([STARTER_ID]);
  });

  it("with Gemini Nano, runs every post on the device and spends no cloud checks", async () => {
    const device = new LabelModel("on_device");
    const budget = cloudBudget(3, memoryStore());
    const { root } = mount({ device: "available", deviceModel: device, hybrid: new Untouchable(), budget });
    await vi.waitFor(() => expect(flat(root.querySelector(".proof"))).toContain("Nothing sent"));
    expect([...root.querySelectorAll(".proof li")].map((e) => flat(e))).toEqual(["▣ On your device", "Free", "Works offline", "Nothing sent"]);
    expect(root.querySelector(".hero .where")).toBeNull();

    button(root, /Check these 5 posts/)!.click();
    await vi.waitFor(() => expect(root.querySelector(".summary")).not.toBeNull());

    expect(device.calls).toBe(5);
    expect(budget.left()).toBe(3);
    const sources = [...root.querySelectorAll(".board .src")].map((e) => e.textContent ?? "");
    expect(sources).toHaveLength(5);
    expect(sources.every((t) => t.includes("ran on device") && t.includes("$0"))).toBe(true);
    expect(flat(root.querySelector(".summary"))).toContain("3 of 5 flagged");
  });

  it("runs pasted text in the cloud only after saying so, and holds corrections back for Gemini Nano", async () => {
    const hybrid = new LabelModel("in_cloud");
    const { root } = mount({ device: "unavailable", hybrid, budget: cloudBudget(5, memoryStore()) });
    await vi.waitFor(() => expect(button(root, /paste your own post/i)).toBeDefined());
    button(root, /paste your own post/i)!.click();
    await vi.waitFor(() => expect(root.querySelector(".detail h2")?.textContent).toBe("Hidden-pay check"));

    expect(root.querySelector(".provenance")?.textContent).toContain("Gemini Nano");
    // Three unseen tests read as 3/3, not as "100%".
    expect([...root.querySelectorAll(".detail .meter b")].map((e) => e.textContent)).toEqual(["9/9", "3/3", "$0"]);
    expect(flat(root.querySelector(".try .where"))).toContain("send this text to Gemini in the cloud");
    button(root, /Run in the cloud/)!.click();
    await vi.waitFor(() => expect(root.querySelector(".result")).not.toBeNull());

    expect(root.querySelector(".result .src")?.textContent).toContain("ran in the cloud: no on-device model here");
    expect(button(root, /^It's /)).toBeUndefined();
    expect(flat(root.querySelector(".result .correct"))).toContain("With Gemini Nano you can correct it");
  });

  it("stops the board on the first failure, says why in words, and spends one check, not five", async () => {
    let calls = 0;
    const failing: JsonModel = {
      async generateJson() {
        calls++;
        throw new Error(
          "AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/p/models/gemini-3.5-flash-lite:generateContent: [401 ] Firebase App Check token is invalid. (AI/fetch-error)",
        );
      },
    };
    const budget = cloudBudget(5, memoryStore());
    const { root } = mount({ device: "unsupported", hybrid: failing, budget });
    await vi.waitFor(() => expect(button(root, /Check these 5 posts/)?.disabled).toBe(false));
    button(root, /Check these 5 posts/)!.click();
    await vi.waitFor(() => expect(root.querySelector(".shield .error-box")).not.toBeNull());

    expect(calls).toBe(1);
    expect(budget.left()).toBe(4);
    expect(flat(root.querySelector(".proof"))).toBe("Refused in this browser");
    const msg = flat(root.querySelector(".shield .error-box p"));
    expect(msg).toMatch(/^Firebase App Check could not confirm this browser/);
    expect(msg).toContain("another normal browser window");
    expect(msg).toContain("watch the demo video");
    expect(msg).not.toMatch(/reload the page|try again/i);
    expect(msg).not.toContain("AI/fetch-error");
    expect(root.querySelector(".summary")).toBeNull();
    // A refusal won't clear on a retry, so there is no Try again, and the SDK's text sits under Details.
    expect(button(root, /Try again/)).toBeUndefined();
    expect(button(root, /Check again/)!.disabled).toBe(true);
    const details = root.querySelector(".shield .error-box details.error-details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(flat(details.querySelector("summary"))).toBe("Details");
    expect(flat(details.querySelector("code"))).toContain("[401 ] Firebase App Check token is invalid. (AI/fetch-error)");
    expect(flat(details)).not.toContain("https://");
    expect(root.querySelector(".shield .error-box a")?.getAttribute("href")).toContain("#try-it");
  });

  it("keeps Try again for errors a retry can clear, such as a busy cloud", async () => {
    const busy: JsonModel = {
      async generateJson() {
        throw new Error("AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/x:generateContent: [429 ] Resource exhausted. (AI/fetch-error)");
      },
    };
    const { root } = mount({ device: "unsupported", hybrid: busy, budget: cloudBudget(5, memoryStore()) });
    await vi.waitFor(() => expect(button(root, /Check these 5 posts/)?.disabled).toBe(false));
    button(root, /Check these 5 posts/)!.click();
    await vi.waitFor(() => expect(root.querySelector(".shield .error-box")).not.toBeNull());

    expect(flat(root.querySelector(".shield .error-box p"))).toMatch(/^Gemini in the cloud is busy/);
    expect(flat(root.querySelector(".shield .error-box details code"))).toContain("[429 ]");
    expect(button(root, /Try again/)).toBeDefined();
  });

  it("never sends text to the cloud when the host offers no fallback", async () => {
    const { root } = mount({ device: "unsupported" });
    await vi.waitFor(() => expect(flat(root.querySelector(".proof"))).toBe("No on-device model to run it"));
    expect(root.querySelector(".hero .where")).toBeNull();
    expect(button(root, /Check these 5 posts/)!.disabled).toBe(true);
  });
});

describe("where each Firebase AI Logic model runs", () => {
  it("keeps the device model on the device and gives only the hybrid model a cloud side", async () => {
    vi.resetModules();
    const made: { mode: string; inCloud?: { model: string } }[] = [];
    vi.doMock("firebase/ai", () => ({
      InferenceMode: { ONLY_ON_DEVICE: "only_on_device", ONLY_IN_CLOUD: "only_in_cloud", PREFER_ON_DEVICE: "prefer_on_device" },
      GoogleAIBackend: class {},
      getAI: () => ({}),
      getGenerativeModel: (_ai: unknown, params: { mode: string; inCloudParams?: { model: string } }) => {
        made.push({ mode: params.mode, inCloud: params.inCloudParams });
        return {
          generateContent: async () => ({
            response: { text: () => '{"label":"standard pay","reason":"r","evidence":""}', inferenceSource: "in_cloud" },
          }),
          initializeDeviceModel: async () => {},
        };
      },
    }));
    const { createModels, DEFAULT_CLOUD_CHECK_MODEL } = await import("../src/firebase/ai");
    const models = createModels({} as never, { compilerModel: "gemini-3.6-flash" });
    const schema = { type: "object" as const };

    await models.device.generateJson("p", schema);
    expect(made.at(-1)).toEqual({ mode: "only_on_device", inCloud: undefined });

    const r = await models.hybrid.generateJson("p", schema);
    expect(made.at(-1)?.mode).toBe("prefer_on_device");
    expect(made.at(-1)?.inCloud?.model).toBe(DEFAULT_CLOUD_CHECK_MODEL);
    expect(r.source).toBe("in_cloud");
    vi.doUnmock("firebase/ai");
  });

  it("leaves the extension on the device only: it reads whole pages, so it never falls back", () => {
    const panel = readFileSync(resolve(process.cwd(), "src/hosts/sidepanel.ts"), "utf8");
    expect(panel).not.toMatch(/hybrid/);
    expect(panel).toContain("models.device");
  });
});
