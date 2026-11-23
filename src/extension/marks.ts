/**
 * Drawing verdicts onto a page: an outline and a badge on each flagged block,
 * and the deciding words highlighted. Kept apart from the content script's
 * messaging so it can be tested without Chrome.
 */
export const ATTR = "data-cantrip-key";
const STYLE_ID = "cantrip-style";
const HIGHLIGHT = "cantrip-evidence";

function ensureStyle(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return;
  const s = doc.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    [${ATTR}].cantrip-flagged { outline: 2px solid #d93d42 !important; outline-offset: 3px; border-radius: 6px; position: relative; }
    .cantrip-badges { all: initial; position: absolute; top: -11px; right: 8px; z-index: 2147483646; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; max-width: calc(100% - 16px); }
    .cantrip-badge { all: initial; font: 600 11.5px/1 system-ui, sans-serif;
      background: #d93d42; color: #fff; padding: 5px 8px; border-radius: 999px; box-shadow: 0 4px 14px -6px rgba(0,0,0,.5); cursor: help; white-space: nowrap; }
    .cantrip-badge small { all: initial; font: 500 11.5px/1 system-ui, sans-serif; color: #fff; opacity: .85; margin-left: 4px; }
    .cantrip-pulse { animation: cantrip-pulse 1.2s ease-out 2; }
    @keyframes cantrip-pulse { 0% { outline-color: #d93d42; } 50% { outline-color: transparent; } 100% { outline-color: #d93d42; } }
    ::highlight(${HIGHLIGHT}) { background-color: #ffe58a; color: #1c1a16; }
  `;
  doc.documentElement.appendChild(s);
}

/** Highlight the quoted words without touching the page's DOM, using the CSS Custom Highlight API. */
function highlightEvidence(el: Element, evidence: string) {
  const reg = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  const Hl = (globalThis as unknown as { Highlight?: new (...r: Range[]) => { add(r: Range): void } }).Highlight;
  if (!reg || !Hl) return;
  const doc = el.ownerDocument;
  const needle = evidence.toLowerCase();
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = (n.textContent ?? "").toLowerCase().indexOf(needle);
    if (i < 0) continue;
    const r = doc.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + evidence.length);
    const existing = reg.get(HIGHLIGHT) as { add(r: Range): void } | undefined;
    if (existing) existing.add(r);
    else reg.set(HIGHLIGHT, new Hl(r));
    return;
  }
}

export function findMarked(doc: Document, key: string): HTMLElement | null {
  return doc.querySelector(`[${ATTR}="${cssEscape(key)}"]`);
}

/**
 * Flag one block. When several cantrips flag the same block, their badges sit
 * side by side in one row rather than on top of each other.
 */
export function markBlock(doc: Document, key: string, name: string, label: string, reason: string, evidence: string | null) {
  const el = findMarked(doc, key);
  if (!el) return;
  ensureStyle(doc);
  el.classList.add("cantrip-flagged");
  if (doc.defaultView?.getComputedStyle(el).position === "static") el.style.position = "relative";
  let row = el.querySelector(":scope > .cantrip-badges") as HTMLElement | null;
  if (!row) {
    row = doc.createElement("span");
    row.className = "cantrip-badges";
    row.setAttribute("data-cantrip-ui", "");
    el.appendChild(row);
  }
  const badge = doc.createElement("span");
  badge.className = "cantrip-badge";
  badge.title = `${name}: ${reason}\nChecked on this device by Gemini Nano.`;
  badge.textContent = `⚑ ${label}`;
  const small = doc.createElement("small");
  small.textContent = "on device";
  badge.appendChild(small);
  row.appendChild(badge);
  if (evidence) highlightEvidence(el, evidence);
}

export function clearMarks(doc: Document) {
  doc.querySelectorAll(".cantrip-badges").forEach((b) => b.remove());
  doc.querySelectorAll(".cantrip-flagged").forEach((e) => e.classList.remove("cantrip-flagged"));
  (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights?.delete(HIGHLIGHT);
}

function cssEscape(s: string): string {
  const esc = (globalThis.CSS as { escape?: (s: string) => string } | undefined)?.escape;
  return esc ? esc(s) : s.replace(/["\\]/g, "\\$&");
}
