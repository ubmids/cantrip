/** Opens the side panel from the toolbar and sends selected text to it from the context menu. */
import type { ToPanel } from "./protocol";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "cantrip-check", title: "Check with Cantrip", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "cantrip-check" || !info.selectionText || !tab?.windowId) return;
  // Opening the panel must happen in the click's own turn.
  await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  const msg: ToPanel = { type: "cantrip/selection", text: info.selectionText };
  // Give a freshly opened panel a moment to start listening.
  setTimeout(() => chrome.runtime.sendMessage(msg).catch(() => {}), 600);
});
