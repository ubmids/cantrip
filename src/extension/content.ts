/**
 * Runs in the page. It never calls a model: it finds readable blocks, hands
 * their text to the side panel (which runs Gemini Nano on the device), and
 * draws the verdicts back onto the page.
 */
import { findBlocks } from "../core/segment";
import { ATTR, clearMarks, findMarked, markBlock } from "./marks";
import type { ScanReply, ToPage } from "./protocol";

let counter = 0;

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

chrome.runtime.onMessage.addListener((msg: ToPage, _sender, reply) => {
  switch (msg.type) {
    case "cantrip/scan":
      clearMarks(document);
      reply(scan());
      return;
    case "cantrip/mark":
      if (msg.verdict.flagged) markBlock(document, msg.key, msg.name, msg.verdict.label, msg.verdict.reason, msg.verdict.evidence);
      reply(true);
      return;
    case "cantrip/clear":
      clearMarks(document);
      reply(true);
      return;
    case "cantrip/reveal": {
      const el = findMarked(document, msg.key);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("cantrip-pulse");
      setTimeout(() => el?.classList.remove("cantrip-pulse"), 2600);
      reply(true);
      return;
    }
  }
});
