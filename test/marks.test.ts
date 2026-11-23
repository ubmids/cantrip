// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findBlocks } from "../src/core/segment";
import { ATTR, clearMarks, markBlock } from "../src/extension/marks";

const long = (s: string) => `${s} `.repeat(20).trim();

function page() {
  document.body.innerHTML = `
    <ul>
      <li ${ATTR}="b1"><h3>Sales rep</h3><p>${long("be your own boss")}</p></li>
      <li ${ATTR}="b2"><h3>Engineer</h3><p>${long("salary and benefits")}</p></li>
    </ul>`;
}

describe("markBlock", () => {
  it("outlines a flagged block and adds a badge saying it ran on the device", () => {
    page();
    markBlock(document, "b1", "Unpaid Job Detector", "commission only", "No base pay.", "be your own boss");
    const el = document.querySelector(`[${ATTR}="b1"]`)!;
    expect(el.classList.contains("cantrip-flagged")).toBe(true);
    const badges = el.querySelectorAll(".cantrip-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("⚑ commission onlyon device");
    expect((badges[0] as HTMLElement).title).toContain("Unpaid Job Detector: No base pay.");
    expect(document.querySelector(`[${ATTR}="b2"]`)!.classList.contains("cantrip-flagged")).toBe(false);
  });

  it("puts badges from two cantrips in one row instead of stacking them on top of each other", () => {
    page();
    markBlock(document, "b1", "Jobs", "commission only", "r", null);
    markBlock(document, "b1", "Scams", "urgent scam", "r", null);
    const el = document.querySelector(`[${ATTR}="b1"]`)!;
    expect(el.querySelectorAll(":scope > .cantrip-badges")).toHaveLength(1);
    expect(el.querySelectorAll(".cantrip-badge")).toHaveLength(2);
  });

  it("keeps its own badges out of the next page read", () => {
    page();
    markBlock(document, "b1", "Jobs", "commission only", "r", null);
    const texts = findBlocks(document.body).map((b) => b.text);
    expect(texts.some((t) => t.includes("on device"))).toBe(false);
  });

  it("reads a badged block exactly as it read before the badge, even when the page repeats the badge's words", () => {
    // jsdom has no innerText. A browser's puts breaks between block elements, which textContent does not.
    const blocks = new Set(["H3", "P", "LI", "UL"]);
    const rendered = (n: Node): string =>
      n.nodeType === Node.TEXT_NODE
        ? (n.textContent ?? "")
        : ((inner) => (blocks.has((n as Element).tagName) ? `\n${inner}\n` : inner))(Array.from(n.childNodes).map(rendered).join(""));
    Object.defineProperty(HTMLElement.prototype, "innerText", { configurable: true, get() { return rendered(this); } });
    try {
      page();
      document.querySelector(`[${ATTR}="b1"] h3`)!.append(" ⚑ commission onlyon device");
      const before = findBlocks(document.body).map((b) => b.text);
      expect(before[0]).toMatch(/^Sales rep ⚑ commission onlyon device be your own boss/);
      markBlock(document, "b1", "Jobs", "commission only", "r", null);
      markBlock(document, "b1", "Pay", "unpaid", "r", null);
      expect(findBlocks(document.body).map((b) => b.text)).toEqual(before);
    } finally {
      delete (HTMLElement.prototype as { innerText?: string }).innerText;
    }
  });

  it("ignores a block that has gone from the page", () => {
    page();
    expect(() => markBlock(document, "b9", "Jobs", "commission only", "r", null)).not.toThrow();
    expect(document.querySelectorAll(".cantrip-badge")).toHaveLength(0);
  });
});

describe("clearMarks", () => {
  it("removes every badge and outline", () => {
    page();
    markBlock(document, "b1", "Jobs", "commission only", "r", null);
    markBlock(document, "b2", "Jobs", "unpaid", "r", null);
    clearMarks(document);
    expect(document.querySelectorAll(".cantrip-badges, .cantrip-badge, .cantrip-flagged")).toHaveLength(0);
  });
});
