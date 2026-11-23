/**
 * Find the readable blocks on a page: a job card, an email, a review, a post.
 * Each block is run through the enabled cantrips on its own, so a verdict
 * points at the one thing it is about rather than the whole page.
 */

export interface Block {
  el: Element;
  text: string;
}

const MIN = 120;
const MAX = 4000;
const SKIP = "script, style, noscript, svg, nav, header, footer, form, button, select, textarea, [aria-hidden='true'], [data-cantrip-ui]";
const CANDIDATES = "article, [role='article'], li, section, div, td, blockquote, p";

function textOf(el: Element): string {
  // Cantrip's own badges must never become part of what the model reads.
  if (el.querySelector("[data-cantrip-ui]")) {
    const copy = el.cloneNode(true) as Element;
    copy.querySelectorAll("[data-cantrip-ui]").forEach((n) => n.remove());
    return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  const t = (el as HTMLElement).innerText ?? el.textContent ?? "";
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Pick the smallest elements that still hold a whole thought: the innermost
 * container whose text fits the size window.
 */
export function findBlocks(root: ParentNode, limit = 40): Block[] {
  const qualifying: Block[] = [];
  const paragraphs: Block[] = [];
  for (const el of Array.from(root.querySelectorAll(CANDIDATES))) {
    if (el.closest(SKIP)) continue;
    const text = textOf(el);
    if (text.length < MIN || text.length > MAX) continue;
    (el.tagName === "P" ? paragraphs : qualifying).push({ el, text });
  }
  // Innermost containers win: a list of job cards yields the cards, not the list.
  const kept = qualifying.filter((b) => !qualifying.some((o) => o !== b && b.el.contains(o.el)));
  // A long paragraph counts on its own only when no container already covers it,
  // so an email with three long paragraphs is still read as one email.
  for (const p of paragraphs) {
    if (!kept.some((k) => k.el.contains(p.el))) kept.push(p);
  }
  // Keep document order.
  kept.sort((a, b) => (a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1));
  return kept.slice(0, limit);
}
