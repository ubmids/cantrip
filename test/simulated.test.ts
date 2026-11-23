// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cantrip } from "../src/core/types";
import { simulatedHost } from "../src/hosts/simulated";
import { mountApp } from "../src/ui/app";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("the simulated walkthrough", () => {
  it("says it is simulated on the home screen, through a compile and at the end", async () => {
    vi.useFakeTimers();
    let list: Cantrip[] = [];
    const root = document.createElement("div");
    document.body.append(root);
    mountApp(root, { ...simulatedHost(), load: async () => list, save: async (l) => void (list = l) });
    await vi.advanceTimersByTimeAsync(50);

    expect(root.querySelector(".banner.sim")?.textContent).toContain("No AI model runs here");
    expect(root.querySelector("footer")?.textContent?.trim()).toBe("Simulated walkthrough: no model runs on this page.");

    (root.querySelector("button.chip") as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);

    expect(root.querySelector(".phase")?.textContent).toContain("Simulated:");
    expect(root.querySelector(".meters")?.textContent).toContain("scripted device runs");
    expect(root.textContent).not.toContain("test runs on your device");
    expect(root.querySelector(".banner.sim")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(root.querySelector(".phase")?.textContent).toContain("Simulated: compiled with scripted answers.");
    expect(root.querySelector(".verdict-banner")?.textContent).toContain("A real compile would run every test on your device.");
    expect(root.textContent).not.toContain("From now on every run happens on your device");
  });
});
