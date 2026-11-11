/**
 * Runs in the page. It never calls a model: it finds readable blocks, hands
 * their text to the side panel (which runs Gemini Nano on the device), and
 * draws the verdicts back onto the page.
 */
import { findBlocks } from "../core/segment";
import type { ScanReply, ToPage } from "./protocol";

const ATTR = "data-cantrip-key";
const STYLE_ID = "cantrip-style";
const HIGHLIGHT = "cantrip-evidence";
let counter = 0;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    [${ATTR}].cantrip-flagged { outline: 2px solid #d93d42 !important; outline-offset: 3px; border-radius: 6px; position: relative; }
    .cantrip-badge { all: initial; position: absolute; top: -11px; right: 8px; z-index: 2147483646; font: 600 11.5px/1 system-ui, sans-serif;
      background: #d93d42; color: #fff; padding: 5px 8px; border-radius: 999px; box-shadow: 0 4px 14px -6px rgba(0,0,0,.5); cursor: help; white-space: nowrap; }
    .cantrip-badge small { font-weight: 500; opacity: .85; margin-left: 4px; }
    .cantrip-pulse { animation: cantrip-pulse 1.2s ease-out 2; }
    @keyframes cantrip-pulse { 0% { outline-color: #d93d42; } 50% { outline-color: transparent; } 100% { outline-color: #d93d42; } }
    ::highlight(${HIGHLIGHT}) { background-color: #ffe58a; color: #1c1a16; }
  `;
  document.documentElement.appendChild(s);
}

function scan(): ScanReply {
  const blocks = findBlocks(document.body).map(({ el, text }) => {
    let key = el.getAttribute(ATTR);
    if (!key) {
      key = `b${++counter}`;
      el.setAttribute(ATTR, key);
    }
    return { key, text };
  });
  return { url: location.href, title: document.title, blocks };
}

/** Highlight the quoted words without touching the page's DOM, using the CSS Custom Highlight API. */
function highlightEvidence(el: Element, evidence: string) {
  const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const Hl = (globalThis as unknown as { Highlight?: new (...r: Range[]) => { add(r: Range): void } }).Highlight;
  if (!reg || !Hl) return;
  const needle = evidence.toLowerCase();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = (n.textContent ?? "").toLowerCase().indexOf(needle);
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + evidence.length);
    const existing = reg.get(HIGHLIGHT) as { add(r: Range): void } | undefined;
    if (existing) existing.add(r);
    else reg.set(HIGHLIGHT, new Hl(r));
    return;
  }
}

function mark(key: string, name: string, label: string, reason: string, evidence: string | null) {
  const el = document.querySelector(`[${ATTR}="${CSS.escape(key)}"]`) as HTMLElement | null;
  if (!el) return;
  ensureStyle();
  el.classList.add("cantrip-flagged");
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const badge = document.createElement("span");
  badge.className = "cantrip-badge";
  badge.setAttribute("data-cantrip-ui", "");
  badge.title = `${name}: ${reason}\nChecked on this device by Gemini Nano.`;
  badge.textContent = `⚑ ${label}`;
  const small = document.createElement("small");
  small.textContent = "on device";
  badge.appendChild(small);
  el.appendChild(badge);
  if (evidence) highlightEvidence(el, evidence);
}

function clear() {
  document.querySelectorAll(".cantrip-badge").forEach((b) => b.remove());
  document.querySelectorAll(".cantrip-flagged").forEach((e) => e.classList.remove("cantrip-flagged"));
  (CSS as unknown as { highlights?: Map<string, unknown> }).highlights?.delete(HIGHLIGHT);
}

chrome.runtime.onMessage.addListener((msg: ToPage, _sender, reply) => {
  switch (msg.type) {
    case "cantrip/scan":
      clear();
      reply(scan());
      return;
    case "cantrip/mark":
      if (msg.verdict.flagged) mark(msg.key, msg.name, msg.verdict.label, msg.verdict.reason, msg.verdict.evidence);
      reply(true);
      return;
    case "cantrip/clear":
      clear();
      reply(true);
      return;
    case "cantrip/reveal": {
      const el = document.querySelector(`[${ATTR}="${CSS.escape(msg.key)}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("cantrip-pulse");
      setTimeout(() => el?.classList.remove("cantrip-pulse"), 2600);
      reply(true);
      return;
    }
  }
});
