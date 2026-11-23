import { html, nothing, render, type TemplateResult } from "lit-html";
import { addCorrection, compileIntent, recompile, type CompileEvent } from "../core/compiler";
import { clip, TARGET_NAMES } from "../core/prompts";
import { runProgram } from "../core/run";
import type { Cantrip, CompiledProgram, JsonModel, Program, Round, Spec, TestCase, TestResult, Verdict } from "../core/types";
import type { DeviceState } from "../firebase/ai";
import type { Host, PageScan } from "./host";
import { copyWithoutBlocking } from "./clipboard";
import { friendlyError } from "../core/errors";
import { SAMPLES } from "./samples";
import { BOARD_POSTS, jobScamShield, STARTER_ID } from "./starter";

interface LiveRound {
  n: number;
  kind: Round["kind"];
  program: Program;
  results: TestResult[];
  total: number;
  done: boolean;
  diagnosis?: string;
}

interface CompileView {
  mode: "new" | "recompile";
  intent: string;
  phase: "designing" | "porting" | "testing" | "repairing" | "holdout" | "done" | "error";
  spec?: Spec;
  tests: TestCase[];
  rounds: LiveRound[];
  holdout: TestResult[];
  holdoutTotal: number;
  cloudCalls: number;
  deviceRuns: number;
  error?: string;
  result?: Cantrip;
  abort: AbortController;
}

interface BoardRun {
  results: ({ verdict: Verdict } | { error: string; limit?: true } | null)[];
  running: boolean;
  /** Why the run stopped early, when it did. */
  stopped?: string;
}

/** Where the next check of a ready cantrip would run, or why it can't. */
type Route =
  | { ok: true; where: "device" | "cloud"; model: JsonModel }
  | { ok: false; why: "checking" | "no-device" | "limit" };

const REPO = "https://github.com/ubmids/cantrip";

interface State {
  loaded: boolean;
  board: BoardRun | null;
  cantrips: Cantrip[];
  device: DeviceState | "checking";
  downloadPct: number | null;
  draft: string;
  compile: CompileView | null;
  openId: string | null;
  tryText: string;
  tryResult: (Verdict & { text: string }) | null;
  tryError: string | null;
  tryBusy: boolean;
  importCode: string;
  confirmDelete: boolean;
  toast: string | null;
  page: PageScan | null;
}

const LIMIT_TEXT =
  "That's every cloud check this visit allows. They are capped because the demo runs on the free Gemini tier. With Gemini Nano in desktop Chrome, checks run on your device with no limit and no cost.";

const pct = (x: number | null | undefined) => (x == null ? "–" : `${Math.round(x * 100)}%`);
const frac = (rs: TestResult[]) => `${rs.filter((r) => r.ok).length}/${rs.length}`;
const secs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export function mountApp(root: HTMLElement, host: Host) {
  const s: State = {
    loaded: false,
    board: null,
    cantrips: [],
    device: "checking",
    downloadPct: null,
    draft: "",
    compile: null,
    openId: null,
    tryText: "",
    tryResult: null,
    tryError: null,
    tryBusy: false,
    importCode: new URLSearchParams(location.search).get("c") ?? "",
    confirmDelete: false,
    toast: null,
    page: null,
  };

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const toast = (msg: string) => {
    s.toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ((s.toast = null), draw()), 3200);
    draw();
  };

  const persist = () => host.save(s.cantrips).catch(() => toast("Couldn't save on this device."));
  const open = () => s.cantrips.find((c) => c.id === s.openId) ?? null;

  async function refreshDevice() {
    s.device = await host.deviceState();
    draw();
  }

  async function downloadModel() {
    s.downloadPct = 0;
    draw();
    try {
      await host.prepareDevice((f) => {
        s.downloadPct = f;
        draw();
      });
    } catch (err) {
      toast(`The on-device model didn't start: ${friendlyError(err)}`);
    }
    s.downloadPct = null;
    await refreshDevice();
  }

  // ---------------------------------------------------------------------------
  // Compiling
  // ---------------------------------------------------------------------------

  function onCompileEvent(e: CompileEvent) {
    const v = s.compile;
    if (!v) return;
    switch (e.type) {
      case "designing":
        v.phase = "designing";
        break;
      case "designed":
        v.spec = e.spec;
        v.tests = e.tests;
        v.cloudCalls += 1;
        break;
      case "porting":
        v.phase = "porting";
        break;
      case "round-start": {
        if (v.rounds.length === 0 && e.kind === "port") v.cloudCalls += 1;
        v.phase = "testing";
        v.rounds.push({ n: e.round, kind: e.kind, program: e.program, results: [], total: v.tests.filter((t) => t.split === "tune").length, done: false });
        break;
      }
      case "test-result":
        v.rounds.at(-1)?.results.push(e.result);
        v.deviceRuns += 1;
        break;
      case "round-end": {
        const r = v.rounds.at(-1);
        if (r) r.done = true;
        break;
      }
      case "repairing":
        v.phase = "repairing";
        break;
      case "repaired": {
        v.cloudCalls += 1;
        const r = v.rounds.at(-1);
        if (r) r.diagnosis = e.diagnosis;
        break;
      }
      case "repair-failed": {
        const r = v.rounds.at(-1);
        if (r) r.diagnosis = "Gemini could not be reached for another repair, so Cantrip kept the best program so far.";
        break;
      }
      case "holdout-start":
        v.phase = "holdout";
        v.holdoutTotal = e.count;
        break;
      case "holdout-result":
        v.holdout.push(e.result);
        v.deviceRuns += 1;
        break;
      case "done":
        v.phase = "done";
        v.result = e.cantrip;
        break;
    }
    draw();
  }

  function newCompileView(mode: CompileView["mode"], intent: string, base?: Cantrip): CompileView {
    return {
      mode,
      intent,
      phase: "designing",
      spec: base?.spec,
      tests: base?.tests ?? [],
      rounds: [],
      holdout: [],
      holdoutTotal: 0,
      cloudCalls: 0,
      deviceRuns: 0,
      abort: new AbortController(),
    };
  }

  async function startCompile(intent: string) {
    if (!intent.trim() || s.compile) return;
    s.compile = newCompileView("new", intent);
    s.openId = null;
    draw();
    try {
      const c = await compileIntent(intent, {
        cloud: host.cloud,
        device: host.device,
        target: host.target,
        maxRounds: host.maxRounds,
        signal: s.compile.abort.signal,
        onEvent: onCompileEvent,
      });
      s.cantrips = [c, ...s.cantrips];
      s.draft = "";
      await persist();
    } catch (err) {
      failCompile(err);
    }
    draw();
  }

  async function startRecompile(base: Cantrip) {
    if (s.compile) return;
    s.compile = newCompileView("recompile", base.spec.intent, base);
    draw();
    try {
      const next = await recompile(base, {
        cloud: host.cloud,
        device: host.device,
        target: host.target,
        maxRounds: host.maxRounds,
        signal: s.compile.abort.signal,
        onEvent: onCompileEvent,
      });
      s.cantrips = s.cantrips.map((c) => (c.id === next.id ? next : c));
      await persist();
    } catch (err) {
      failCompile(err);
    }
    draw();
  }

  function failCompile(err: unknown) {
    if (!s.compile) return;
    s.compile.phase = "error";
    s.compile.error = friendlyError(err);
  }

  function closeCompile(openResult: boolean) {
    const id = s.compile?.result?.id;
    s.compile = null;
    if (openResult && id) openCantrip(id);
    draw();
  }

  // ---------------------------------------------------------------------------
  // Running, correcting, sharing
  // ---------------------------------------------------------------------------

  function openCantrip(id: string | null) {
    s.openId = id;
    s.confirmDelete = false;
    s.tryResult = null;
    s.tryError = null;
    const c = id ? s.cantrips.find((x) => x.id === id) : null;
    const sample = c ? SAMPLES.find((x) => x.intent === c.spec.intent) : undefined;
    s.tryText = sample?.tries[0] ?? "";
    draw();
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  /**
   * Gemini Nano when this browser has it. Otherwise, in the web app, Firebase AI Logic's hybrid mode,
   * which sends the text to Gemini in the cloud, within the session's cap.
   */
  function route(): Route {
    if (s.device === "available") return { ok: true, where: "device", model: host.device };
    if (s.device === "checking") return { ok: false, why: "checking" };
    if (!host.hybrid || !host.cloudBudget) return { ok: false, why: "no-device" };
    if (host.cloudBudget.left() <= 0) return { ok: false, why: "limit" };
    return { ok: true, where: "cloud", model: host.hybrid };
  }

  /**
   * Run one ready cantrip on one text where the route says, spending a cloud check when it goes to
   * the cloud. Errors come back as sentences a person can act on.
   */
  async function check(c: Cantrip, text: string): Promise<{ verdict: Verdict } | { error: string; limit?: true }> {
    const compiled = c.programs[host.target];
    if (!compiled) return { error: "This cantrip has no program for this device yet." };
    const r = route();
    if (!r.ok) return r.why === "limit" ? { error: LIMIT_TEXT, limit: true } : { error: "No model can run this in this browser." };
    if (r.where === "cloud" && !host.cloudBudget!.take()) return { error: LIMIT_TEXT, limit: true };
    try {
      return { verdict: await runProgram(r.model, c.spec, compiled.program, text) };
    } catch (err) {
      return { error: friendlyError(err, { cloudCheck: r.where === "cloud" }) };
    }
  }

  async function tryIt(c: Cantrip) {
    const compiled = c.programs[host.target];
    if (!compiled || !s.tryText.trim() || s.tryBusy) return;
    s.tryBusy = true;
    s.tryError = null;
    s.tryResult = null;
    draw();
    const out = await check(c, s.tryText);
    if ("verdict" in out) s.tryResult = { ...out.verdict, text: clip(s.tryText) };
    else s.tryError = out.error;
    s.tryBusy = false;
    draw();
  }

  /** Put the Job-scam shield in the library, once. */
  async function addStarter(): Promise<Cantrip> {
    const have = s.cantrips.find((c) => c.id === STARTER_ID);
    if (have) return have;
    const c = jobScamShield();
    s.cantrips = [c, ...s.cantrips];
    await persist();
    return c;
  }

  async function openStarter() {
    const c = await addStarter();
    openCantrip(c.id);
  }

  /** Run the Job-scam shield on the sample board, one post at a time, so results land as they come. */
  async function checkBoard() {
    if (s.board?.running) return;
    const shield = await addStarter();
    s.board = { results: BOARD_POSTS.map(() => null), running: true };
    draw();
    for (let i = 0; i < BOARD_POSTS.length; i++) {
      const r = route();
      if (!r.ok) {
        s.board.stopped = r.why === "limit" ? LIMIT_TEXT : "This browser can't run the check.";
        break;
      }
      const out = await check(shield, `${BOARD_POSTS[i].title}. ${BOARD_POSTS[i].body}`);
      if ("limit" in out) {
        s.board.stopped = out.error;
        break;
      }
      s.board.results[i] = out;
      draw();
    }
    s.board.running = false;
    draw();
  }

  async function correct(c: Cantrip, text: string, label: string) {
    const next = addCorrection(c, text, label);
    s.cantrips = s.cantrips.map((x) => (x.id === c.id ? next : x));
    await persist();
    s.tryResult = null;
    toast("Added to its tests. Recompiling so it learns this one.");
    await startRecompile(next);
  }

  async function share(c: Cantrip) {
    if (!host.share) return;
    try {
      const code = await host.share(c);
      const next = { ...c, shareCode: code };
      s.cantrips = s.cantrips.map((x) => (x.id === c.id ? next : x));
      await persist();
      // Show the code straight away: the clipboard can stall, and a second press must reuse this code.
      draw();
      const link = `${location.origin}${location.pathname}?c=${code}`;
      const copied = await copyWithoutBlocking(() => navigator.clipboard?.writeText(host.kind === "web" ? link : code));
      toast(copied ? `Shared as ${code}. Copied ${host.kind === "web" ? "the link" : "the code"}.` : `Shared as ${code}.`);
    } catch (err) {
      toast(`Couldn't share: ${friendlyError(err)}`);
    }
  }

  async function install() {
    if (!host.install || !s.importCode.trim()) return;
    try {
      const c = await host.install(s.importCode);
      if (!c) return toast("No cantrip has that code.");
      s.cantrips = [c, ...s.cantrips.filter((x) => x.shareCode !== c.shareCode)];
      s.importCode = "";
      await persist();
      openCantrip(c.id);
      toast(c.programs[host.target] ? "Installed and ready on this device." : "Installed. Compile it for this device to use it.");
    } catch (err) {
      toast(`Couldn't install: ${friendlyError(err)}`);
    }
  }

  async function setEnabled(c: Cantrip, enabled: boolean) {
    s.cantrips = s.cantrips.map((x) => (x.id === c.id ? { ...x, enabled } : x));
    await persist();
    draw();
  }

  async function remove(c: Cantrip) {
    s.cantrips = s.cantrips.filter((x) => x.id !== c.id);
    s.openId = null;
    s.confirmDelete = false;
    await persist();
    draw();
  }

  async function scanPage() {
    if (!host.page) return;
    const active = s.cantrips.filter((c) => c.enabled && c.programs[host.target]);
    if (!active.length) return toast("Turn on a compiled cantrip first.");
    try {
      await host.page.scan(active, (scan) => {
        s.page = scan;
        draw();
      });
    } catch (err) {
      toast(friendlyError(err));
    }
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  const devicePill = () => {
    const d = s.device;
    if (host.simulated) return html`<span class="pill muted"><i class="dot"></i>Simulated models</span>`;
    if (s.downloadPct != null)
      return html`<span class="pill device"><i class="dot"></i>Downloading model ${pct(s.downloadPct)}</span>`;
    const fallback = d !== "available" && d !== "checking" && host.hybrid;
    const label: Record<string, string> = {
      checking: "Checking this browser…",
      available: `${host.target === "gemini-nano" ? "Gemini Nano" : "On-device model"} ready`,
      downloadable: fallback ? "Model not downloaded · cloud fallback" : "On-device model not downloaded",
      downloading: fallback ? "Model downloading · cloud fallback" : "On-device model downloading",
      unavailable: fallback ? "No on-device model · cloud fallback" : "No on-device model here",
      unsupported: fallback ? "No on-device model · cloud fallback" : "This browser has no on-device model",
    };
    return html`<span class="pill ${d === "available" ? "device" : fallback ? "cloud-pill" : "muted"}" title=${TARGET_NAMES[host.target]}
      ><i class="dot ${d === "checking" ? "pulse" : ""}"></i>${label[d]}</span
    >`;
  };

  /** Why compiling needs Gemini Nano, and what to do without it. Shown under the composer. */
  const deviceHelp = () => {
    if (s.device === "available" || s.device === "checking" || s.downloadPct != null) return nothing;
    if (s.device === "downloadable" || s.device === "downloading")
      return html`<div class="notice">
        <p>
          Compiling tests the program on the model that will run it, so it needs Gemini Nano. Chrome downloads it once
          (about 4 GB, and it wants about 22 GB of free disk space).
        </p>
        <button class="btn" @click=${downloadModel}>Download the model</button>
      </div>`;
    const walkthrough =
      host.kind === "web" && !host.simulated
        ? html`<p class="small">
            No Gemini Nano here? The Job-scam shield above still runs, in the cloud. To see a compile, open the
            <a href="?preview">simulated walkthrough</a> (scripted, no model runs in it) or the demo video linked in the
            <a href=${REPO} target="_blank" rel="noopener">README</a>.
          </p>`
        : nothing;
    return html`<div class="notice">
      <p>
        ${s.device === "unavailable"
          ? html`Compiling tests the program on Gemini Nano, on your device. Chrome offers Gemini Nano here but says it
              can't run on this computer: it needs about 22 GB of free disk space and either 16 GB of memory or a GPU with
              more than 4 GB of VRAM.`
          : html`Compiling tests the program on Gemini Nano, on your device, and this browser doesn't offer it. Use an
              up-to-date desktop Chrome (148 or later) on a computer with about 22 GB of free disk space and 16 GB of
              memory.`}
        <code>chrome://on-device-internals</code> shows what Chrome is missing.
      </p>
      ${walkthrough}
    </div>`;
  };

  const header = () => html`<header class="top">
    <a class="mark" href="#" @click=${(e: Event) => (e.preventDefault(), closeCompile(false), openCantrip(null))}
      ><span class="spark" aria-hidden="true">✦</span>cantrip</a
    >
    ${devicePill()}
  </header>`;

  const banners = () => html`${host.simulated
      ? html`<div class="banner sim" role="note">
          <b>Simulated walkthrough.</b> No AI model runs here: the cloud and device answers are scripted, to show the
          interface only, and only the commission-only sample is scripted. Real compiles need Gemini Nano in desktop Chrome.
          ${host.kind === "web" && new URLSearchParams(location.search).has("preview")
            ? html`<a href=${location.pathname}>Leave the walkthrough</a>`
            : nothing}
        </div>`
      : nothing}
    ${host.setupProblem ? html`<div class="banner warn">${host.setupProblem}</div>` : nothing}`;

  /** The board and the composer both start here when there is no hero (the simulated walkthrough keeps its old look). */
  const composer = () => html`<section class="composer card" id="compose">
    ${hero()
      ? html`<p class="eyebrow">Your own rule</p>
          <h2>Watching for a different trap? Say it in one sentence.</h2>
          <p class="lede">
            Gemini in the cloud writes a tiny program for the model on your device, tests it there, and fixes what fails.
            Then it runs on every page for free, and what you read never leaves your machine.
          </p>`
      : html`<h1>Teach your browser a rule.</h1>
          <p class="lede">
            Say what to watch for. Gemini in the cloud writes a tiny program for the model on your device, tests it
            there, and fixes what fails. Then it runs on every page for free, and what you read never leaves your machine.
          </p>`}
    <form
      @submit=${(e: Event) => {
        e.preventDefault();
        startCompile(s.draft);
      }}
    >
      <label class="sr" for="intent">What should Cantrip watch for?</label>
      <textarea
        id="intent"
        rows="3"
        maxlength="400"
        placeholder="Warn me when a job post is really commission-only…"
        .value=${s.draft}
        @input=${(e: Event) => ((s.draft = (e.target as HTMLTextAreaElement).value), draw())}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startCompile(s.draft);
        }}
      ></textarea>
      <div class="chips">
        ${(host.simulated ? SAMPLES.slice(0, 1) : SAMPLES).map(
          (x) => html`<button type="button" class="chip" @click=${() => ((s.draft = x.intent), draw())}>${x.chip}</button>`,
        )}
      </div>
      <div class="row end">
        <button class="btn primary" ?disabled=${!host.ready || !s.draft.trim() || s.device !== "available"}>
          Compile <span class="arrow">☁ → ▣</span>
        </button>
      </div>
    </form>
    ${deviceHelp()}
  </section>`;

  /** The hero only shows in the real web app: the simulated walkthrough stays as it was. */
  const hero = () => host.kind === "web" && !host.simulated;

  /** One line before a run that says where it will happen, so text never goes to the cloud unannounced. */
  const routeNote = (count: number) => {
    const r = route();
    if (r.ok && r.where === "device")
      return html`<p class="where device-note"><span class="device">▣</span> Runs on Gemini Nano on this device. Nothing is sent anywhere.</p>`;
    if (r.ok && r.where === "cloud") {
      const left = host.cloudBudget!.left();
      return html`<p class="where cloud-note">
        <span aria-hidden="true">☁︎</span> This browser has no on-device model, so Firebase AI Logic will send
        ${count === 1 ? "this text" : "these posts"} to Gemini in the cloud instead. Each result says where it ran.
        <span class="muted">${left} cloud ${left === 1 ? "check" : "checks"} left this visit.</span>
      </p>`;
    }
    if (!r.ok && r.why === "checking") return html`<p class="where muted"><i class="spinner tiny"></i> Checking this browser…</p>`;
    if (!r.ok && r.why === "limit") return html`<p class="where limit">${LIMIT_TEXT}</p>`;
    return html`<p class="where muted">This browser has no on-device model to run it.</p>`;
  };

  const boardCard = (i: number) => {
    const post = BOARD_POSTS[i];
    const out = s.board?.results[i] ?? null;
    const pending = s.board?.running && !out;
    const v = out && "verdict" in out ? out.verdict : null;
    return html`<li class="post ${v?.flagged ? "is-flagged" : v ? "is-fine" : ""} ${pending ? "pending" : ""}">
      ${v?.flagged
        ? html`<span class="badges"><span class="badge">⚑ ${v.label}</span></span>`
        : nothing}
      <h3>${post.title}</h3>
      <p class="meta">${post.meta}</p>
      <p class="body">${v ? highlight(post.body, v.evidence) : post.body}</p>
      ${v
        ? html`<p class="post-verdict">
            ${v.flagged ? nothing : html`<span class="ok-label">✓ ${v.label}</span>`}
            <span class="reason-line">${v.reason}</span>
            ${sourceBadge(v)}
          </p>`
        : out && "error" in out
          ? html`<p class="post-verdict flag small">${out.error}</p>`
          : pending
            ? html`<p class="post-verdict muted small"><i class="spinner tiny"></i> Waiting for its turn…</p>`
            : nothing}
    </li>`;
  };

  const board = () => {
    const b = s.board;
    const done = b ? b.results.filter(Boolean).length : 0;
    const flagged = b ? b.results.filter((x) => x && "verdict" in x && x.verdict.flagged).length : 0;
    const r = route();
    return html`<section class="hero">
      <p class="eyebrow">For job seekers</p>
      <h1>Catch the job posts that hide there's no pay.</h1>
      <p class="lede">
        Some posts bury the fact that a role is commission-only or unpaid. Cantrip reads each post and flags those, quoting
        the words that give it away. With Gemini Nano in Chrome it runs on your own device, for free, so your job search
        never leaves your machine.
      </p>
      <div class="card shield">
        <div class="row between wrap">
          <div>
            <h2 class="shield-title">Job-scam shield</h2>
            <p class="muted small">Five sample posts from made-up companies. Try it on them, or on a post of your own.</p>
          </div>
          <div class="row wrap gap">
            <button class="btn ghost small" @click=${openStarter}>Paste your own post</button>
            <button class="btn primary" ?disabled=${!r.ok || b?.running} @click=${checkBoard}>
              ${b?.running ? html`<i class="spinner tiny light"></i> Checking ${done + 1} of ${BOARD_POSTS.length}…` : b ? "Check again" : `Check these ${BOARD_POSTS.length} posts`}
            </button>
          </div>
        </div>
        ${b && !b.running
          ? html`<p class="summary" role="status">
              <b class=${flagged ? "flag" : "device"}>${flagged} of ${done} flagged</b>
              ${done < BOARD_POSTS.length ? html`<span class="muted">· ${BOARD_POSTS.length - done} not checked</span>` : nothing}
            </p>`
          : nothing}
        ${b?.stopped ? html`<p class="where limit">${b.stopped}</p>` : routeNote(BOARD_POSTS.length)}
        <ol class="board" aria-live="polite">
          ${BOARD_POSTS.map((_, i) => boardCard(i))}
        </ol>
      </div>
      <div class="realboard">
        <h3>On a real job board</h3>
        <p>
          The Cantrip Chrome extension does the same to the page you are reading. Press <b>Read this page</b> and it splits
          the page into posts, checks each one with Gemini Nano on your device, and puts a badge like these on the ones
          that hide their pay, with the deciding words highlighted. The page never leaves your machine, and the extension
          never falls back to the cloud. It is not in the Chrome Web Store yet: the
          <a href=${REPO} target="_blank" rel="noopener">README</a> shows how to load it.
        </p>
      </div>
    </section>`;
  };

  const dots = (results: TestResult[], total: number, tests: TestCase[]) => {
    const byId = new Map(tests.map((t) => [t.id, t]));
    return html`<div class="dots" role="list">
      ${results.map((r) => {
        const t = byId.get(r.testId);
        const tip = `${r.ok ? "Passed" : "Failed"}: expected ${r.expected}, got ${r.got ?? "no answer"}${t ? `\n“${clip(t.input, 140)}”` : ""}`;
        return html`<span role="listitem" class="d ${r.ok ? "ok" : "bad"} ${t?.origin === "user" ? "user" : ""}" title=${tip}></span>`;
      })}
      ${Array.from({ length: Math.max(0, total - results.length) }, () => html`<span class="d wait"></span>`)}
    </div>`;
  };

  const phaseLine = (v: CompileView) => {
    if (host.simulated && v.phase !== "error") {
      const sim: Record<Exclude<CompileView["phase"], "error">, string> = {
        designing: "Simulated: a scripted program and tests, no Gemini call…",
        porting: "Simulated: a scripted port, no Gemini call…",
        testing: "Simulated: running the scripted tests, no model…",
        repairing: "Simulated: a scripted repair, no Gemini call…",
        holdout: "Simulated: scripted unseen tests, no model…",
        done: "Simulated: compiled with scripted answers.",
      };
      return html`<span class="muted">${sim[v.phase]}</span>`;
    }
    const lines: Record<CompileView["phase"], TemplateResult> = {
      designing: html`<span class="cloud">☁ Gemini is writing the program and its tests…</span>`,
      porting: html`<span class="cloud">☁ Gemini is adapting the program for ${TARGET_NAMES[host.target]}…</span>`,
      testing: html`<span class="device">▣ Running the tests on your device…</span>`,
      repairing: html`<span class="cloud">☁ Gemini is reading the failures and rewriting the program…</span>`,
      holdout: html`<span class="device">▣ Checking it on tests the repairs never saw…</span>`,
      done: html`<span>Compiled.</span>`,
      error: html`<span class="flag">${v.error}</span>`,
    };
    return lines[v.phase];
  };

  const roundTitle = (r: LiveRound) =>
    r.kind === "design" ? "First draft" : r.kind === "port" ? "Ported draft" : r.n === 1 ? "Current program" : `Repair ${r.n - 1}`;

  const compileTheatre = (v: CompileView) => {
    const best = v.rounds.filter((r) => r.done).reduce((m, r) => Math.max(m, r.results.filter((x) => x.ok).length / (r.results.length || 1)), 0);
    const compiled = v.result?.programs[host.target];
    return html`<section class="theatre card" aria-live="polite">
      <div class="row between">
        <h2>${v.spec?.name ?? "Compiling"}</h2>
        ${v.phase === "done" || v.phase === "error"
          ? nothing
          : html`<button class="btn ghost small" @click=${() => v.abort.abort()}>Stop</button>`}
      </div>
      <p class="intent">“${v.intent}”</p>
      ${v.spec
        ? html`<div class="labels">
            ${v.spec.labels.map((l) => html`<span class="label ${v.spec!.flagLabels.includes(l) ? "flagged" : ""}">${l}</span>`)}
          </div>`
        : nothing}
      <div class="meters">
        <div class="meter cloud"><b>${v.cloudCalls}</b><span>${host.simulated ? "scripted " : ""}cloud ${v.cloudCalls === 1 ? "call" : "calls"}${host.simulated ? "" : " to compile"}</span></div>
        <div class="meter device"><b>${v.deviceRuns}</b><span>${host.simulated ? "scripted device runs" : "test runs on your device"}</span></div>
        <div class="meter"><b>${pct(best || null)}</b><span>best so far</span></div>
      </div>
      <p class="phase">${v.phase === "done" ? nothing : html`<i class="spinner"></i>`}${phaseLine(v)}</p>
      <ol class="rounds">
        ${v.rounds.map(
          (r) => html`<li class="round ${r.done ? "done" : "live"}">
            <div class="row between">
              <span class="rname">${roundTitle(r)}</span>
              <span class="score">${frac(r.results)}${r.done ? "" : ` of ${r.total}`}</span>
            </div>
            ${dots(r.results, r.total, v.tests)}
            ${r.diagnosis ? html`<p class="diag"><span class="cloud">☁</span> ${r.diagnosis}</p>` : nothing}
          </li>`,
        )}
        ${v.holdoutTotal
          ? html`<li class="round holdout ${v.phase === "done" ? "done" : "live"}">
              <div class="row between">
                <span class="rname">Unseen tests</span><span class="score">${frac(v.holdout)}${v.phase === "done" ? "" : ` of ${v.holdoutTotal}`}</span>
              </div>
              ${dots(v.holdout, v.holdoutTotal, v.tests)}
            </li>`
          : nothing}
      </ol>
      ${v.phase === "done" && compiled
        ? html`<div class="verdict-banner">
            ${host.simulated
              ? html`<p><b>Simulated.</b> These scores are scripted and no model ran. A real compile would run every test on your device.</p>`
              : html`<p>
                  <b>Ready.</b> Passed ${pct(compiled.tuneAccuracy)} of its tuning tests and
                  ${compiled.holdoutAccuracy == null ? "had no unseen tests" : html`${pct(compiled.holdoutAccuracy)} of tests it never trained on`}.
                  From now on every run happens on your device: no cloud call, no cost, works offline.
                </p>`}
            <button class="btn primary" @click=${() => closeCompile(true)}>Try it</button>
          </div>`
        : nothing}
      ${v.phase === "error"
        ? html`<div class="row end">
            <button class="btn ghost" @click=${() => closeCompile(false)}>Back</button>
            ${v.mode === "new"
              ? html`<button class="btn primary" @click=${() => ((s.compile = null), startCompile(v.intent))}>Try again</button>`
              : nothing}
          </div>`
        : nothing}
    </section>`;
  };

  const highlight = (text: string, evidence: string | null) => {
    if (!evidence) return text;
    const i = text.toLowerCase().indexOf(evidence.toLowerCase());
    if (i < 0) return text;
    return html`${text.slice(0, i)}<mark>${text.slice(i, i + evidence.length)}</mark>${text.slice(i + evidence.length)}`;
  };

  const sourceBadge = (v: Verdict) =>
    host.simulated
      ? html`<span class="src">simulated · no model ran</span>`
      : v.source === "in_cloud"
        ? html`<span class="src in-cloud">☁︎ ran in the cloud: no on-device model here · ${secs(v.ms)}</span>`
        : v.source === "on_device"
          ? html`<span class="src device">▣ ran on device · ${secs(v.ms)} · $0</span>`
          : html`<span class="src muted">${secs(v.ms)}</span>`;

  const programView = (p: CompiledProgram) => html`<details class="program">
    <summary>See the program Gemini wrote for ${TARGET_NAMES[p.target]}</summary>
    <pre>${p.program.systemPrompt}</pre>
    ${p.program.examples.map(
      (e) => html`<div class="ex"><span class="label ${""}">${e.label}</span> ${clip(e.input, 220)}</div>`,
    )}
    <p class="muted small">
      ${p.rounds.length} round${p.rounds.length === 1 ? "" : "s"} on the device:
      ${p.rounds.map((r) => pct(r.accuracy)).join(" → ")}. ${p.cloudCalls} cloud ${p.cloudCalls === 1 ? "call" : "calls"}, ${p.deviceCalls} device runs.
    </p>
  </details>`;

  const tryPanel = (c: Cantrip) => {
    const compiled = c.programs[host.target];
    const sample = SAMPLES.find((x) => x.intent === c.spec.intent);
    if (!compiled)
      return html`<div class="notice">
        <p>
          This cantrip was compiled for ${Object.keys(c.programs).map((t) => TARGET_NAMES[t as keyof typeof TARGET_NAMES]).join(" and ")}.
          Small models differ, so Gemini will adapt it and test it again on this one.
        </p>
        <button class="btn primary" ?disabled=${s.device !== "available"} @click=${() => startRecompile(c)}>Compile for this device</button>
      </div>`;
    const r = s.tryResult;
    const way = route();
    // A correction recompiles, and compiling runs the tests on Gemini Nano.
    const canCorrect = host.simulated || s.device === "available";
    return html`<section class="try">
      <h3>Try it on anything</h3>
      ${sample
        ? html`<div class="chips">
            ${sample.tries.map(
              (t, i) => html`<button class="chip ${s.tryText === t ? "on" : ""}" @click=${() => ((s.tryText = t), (s.tryResult = null), (s.tryError = null), draw())}>Example ${i + 1}</button>`,
            )}
          </div>`
        : nothing}
      <label class="sr" for="try-text">Text to check</label>
      <textarea id="try-text" rows="5" placeholder="Paste a job post, an email, a review…" .value=${s.tryText}
        @input=${(e: Event) => ((s.tryText = (e.target as HTMLTextAreaElement).value), draw())}></textarea>
      ${host.simulated ? nothing : routeNote(1)}
      <div class="row end">
        <button class="btn primary" ?disabled=${s.tryBusy || !s.tryText.trim() || !way.ok} @click=${() => tryIt(c)}>
          ${s.tryBusy
            ? html`<i class="spinner tiny light"></i> ${way.ok && way.where === "cloud" ? "Running in the cloud…" : "Running on device…"}`
            : way.ok && way.where === "cloud"
              ? "Run in the cloud"
              : "Run on device"}
        </button>
      </div>
      ${s.tryError
        ? html`<div class="error-box" role="alert">
            <p>${s.tryError}</p>
            ${way.ok ? html`<button class="btn small" @click=${() => tryIt(c)}>Try again</button>` : nothing}
          </div>`
        : nothing}
      ${r
        ? html`<div class="result ${r.flagged ? "is-flagged" : "is-fine"}">
            <div class="row between">
              <span class="label big ${r.flagged ? "flagged" : ""}">${r.flagged ? "⚑ " : "✓ "}${r.label}</span>
              ${sourceBadge(r)}
            </div>
            <p class="reason">${r.reason}</p>
            <blockquote>${highlight(r.text, r.evidence)}</blockquote>
            ${canCorrect
              ? html`<div class="correct">
                  <span class="muted small">Wrong? Tell it the right answer and it recompiles:</span>
                  ${c.spec.labels
                    .filter((l) => l !== r.label)
                    .map((l) => html`<button class="chip" @click=${() => correct(c, r.text, l)}>It's ${l}</button>`)}
                </div>`
              : html`<p class="muted small correct">
                  Wrong? With Gemini Nano you can correct it, and Cantrip recompiles on your device so it learns that case.
                </p>`}
          </div>`
        : nothing}
    </section>`;
  };

  const pagePanel = () => {
    if (!host.page) return nothing;
    const scan = s.page;
    const flagged = scan?.results.filter((x) => x.verdict?.flagged) ?? [];
    const byId = new Map(s.cantrips.map((c) => [c.id, c]));
    return html`<section class="card page">
      <div class="row between">
        <h2>This page</h2>
        <button class="btn small" ?disabled=${scan?.running || s.device !== "available"} @click=${scanPage}>
          ${scan?.running ? "Reading…" : scan ? "Read again" : "Read this page"}
        </button>
      </div>
      ${scan
        ? html`<p class="muted small">
              ${scan.blocks} blocks · ${scan.results.length} checks on your device ·
              ${flagged.length ? html`<b class="flag">${flagged.length} flagged</b>` : "nothing flagged"}
            </p>
            <ul class="hits">
              ${flagged.map(
                (h) => html`<li>
                  <button class="hit" @click=${() => host.page!.reveal(h.key)}>
                    <span class="label flagged">⚑ ${h.verdict!.label}</span>
                    <span class="small muted">${byId.get(h.cantripId)?.spec.name}</span>
                    <span class="preview">${h.preview}</span>
                  </button>
                </li>`,
              )}
            </ul>`
        : html`<p class="muted small">Runs your active cantrips on each post, card and message on the open tab.</p>`}
    </section>`;
  };

  const detail = (c: Cantrip) => {
    const compiled = c.programs[host.target];
    const userTests = c.tests.filter((t) => t.origin === "user").length;
    return html`<section class="card detail">
      <button class="back" @click=${() => openCantrip(null)}>← All cantrips</button>
      <div class="row between">
        <h2>${c.spec.name}</h2>
        <label class="switch"><input type="checkbox" .checked=${c.enabled} @change=${(e: Event) => setEnabled(c, (e.target as HTMLInputElement).checked)} /><span>On</span></label>
      </div>
      <p class="intent">“${c.spec.intent}”</p>
      <div class="labels">${c.spec.labels.map((l) => html`<span class="label ${c.spec.flagLabels.includes(l) ? "flagged" : ""}">${l}</span>`)}</div>
      ${c.provenance ? html`<p class="provenance small">${c.provenance}</p>` : nothing}
      ${compiled
        ? html`<div class="meters">
              <div class="meter"><b>${pct(compiled.tuneAccuracy)}</b><span>tuning tests</span></div>
              <div class="meter"><b>${pct(compiled.holdoutAccuracy)}</b><span>unseen tests</span></div>
              <div class="meter device"><b>$0</b><span>per run, on device</span></div>
            </div>
            ${programView(compiled)}`
        : nothing}
      ${tryPanel(c)}
      <div class="row between foot">
        <span class="muted small">${c.tests.length} tests${userTests ? `, ${userTests} from your corrections` : ""}</span>
        <span class="row">
          ${host.share ? html`<button class="btn ghost small" @click=${() => share(c)}>${c.shareCode ? `Shared · ${c.shareCode}` : "Share"}</button>` : nothing}
          ${s.confirmDelete
            ? html`<button class="btn ghost small" @click=${() => ((s.confirmDelete = false), draw())}>Keep</button>
                <button class="btn small danger" @click=${() => remove(c)}>Delete for good</button>`
            : html`<button class="btn ghost small danger" @click=${() => ((s.confirmDelete = true), draw())}>Delete</button>`}
        </span>
      </div>
    </section>`;
  };

  const library = () => html`<section class="library">
    <h2>Your cantrips</h2>
    ${!s.loaded
      ? html`<div class="skeleton" aria-busy="true" aria-label="Loading your cantrips"><span></span><span></span></div>`
      : s.cantrips.length
        ? nothing
        : html`<p class="empty">
            Nothing here yet. ${hero()
              ? html`Check the sample posts above to add the Job-scam shield, or write your own rule.`
              : html`Compile a rule above${host.install ? ", or install one by its code" : ""}.`}
          </p>`}
    <ul class="list">
      ${s.cantrips.map((c) => {
        const p = c.programs[host.target];
        return html`<li>
          <button class="item card" @click=${() => openCantrip(c.id)}>
            <span class="row between">
              <b>${c.spec.name}</b>
              <span class="small ${c.enabled ? "device" : "muted"}">${c.enabled ? "on" : "off"}</span>
            </span>
            <span class="small muted">${c.spec.description || c.spec.intent}</span>
            <span class="small">${p ? html`<span class="device">▣ ${p.holdoutAccuracy == null ? `${pct(p.tuneAccuracy)} on its tests` : `${pct(p.holdoutAccuracy)} on unseen tests`}</span>` : html`<span class="muted">Needs compiling for this device</span>`}</span>
          </button>
        </li>`;
      })}
    </ul>
    ${host.install
      ? html`<form class="install row" @submit=${(e: Event) => (e.preventDefault(), install())}>
          <input aria-label="Share code" placeholder="Have a code? e.g. 7hq2kxm" .value=${s.importCode}
            @input=${(e: Event) => ((s.importCode = (e.target as HTMLInputElement).value), draw())} />
          <button class="btn small" ?disabled=${!s.importCode.trim()}>Install</button>
        </form>`
      : nothing}
  </section>`;

  function draw() {
    const c = open();
    render(
      html`<div class="app ${host.kind}">
        ${header()} ${banners()}
        <main>
          ${s.compile ? compileTheatre(s.compile) : c ? detail(c) : html`${hero() ? board() : nothing} ${composer()} ${pagePanel()} ${library()}`}
        </main>
        <footer class="small muted">
          ${host.simulated
            ? "Simulated walkthrough: no model runs on this page."
            : host.hybrid
              ? "Compiled in the cloud by Gemini. Run on your device by Gemini Nano, or in the cloud when a browser has none, and every result says which. All through Firebase AI Logic."
              : "Compiled in the cloud by Gemini, run on your device, all through Firebase AI Logic."}
        </footer>
        ${s.toast ? html`<div class="toast" role="status">${s.toast}</div>` : nothing}
      </div>`,
      root,
    );
  }

  // Boot
  draw();
  refreshDevice();
  host
    .load()
    .then((list) => {
      s.cantrips = list;
      s.loaded = true;
      draw();
      if (s.importCode) install();
    })
    .catch(() => ((s.loaded = true), toast("Couldn't load your cantrips.")));
  host.onSelection?.((text) => {
    const active = s.cantrips.find((c) => c.enabled && c.programs[host.target]);
    if (!active) return toast("Compile a cantrip first, then send text to it.");
    openCantrip(active.id);
    s.tryText = text;
    draw();
    tryIt(active);
  });
}
