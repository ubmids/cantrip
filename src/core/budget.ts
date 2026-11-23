/**
 * A cap on cloud checks per browser session.
 *
 * When a browser has no on-device model, the web app can run a ready cantrip
 * in the cloud instead (Firebase AI Logic's PREFER_ON_DEVICE mode). The hosted
 * site runs on the free Gemini tier, so each session gets a small number of
 * cloud checks. Checks on the device are never counted or capped.
 */
export const CLOUD_CHECKS_PER_SESSION = 15;

export interface CloudBudget {
  readonly limit: number;
  /** Cloud checks still allowed in this session. */
  left(): number;
  /** Spend one check. False when none are left. */
  take(): boolean;
}

type Store = Pick<Storage, "getItem" | "setItem">;

export function cloudBudget(limit = CLOUD_CHECKS_PER_SESSION, store?: Store | null, key = "cantrip.cloudChecks"): CloudBudget {
  const cap = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
  // Session storage keeps the count across reloads. Private windows can refuse it, so keep a copy in memory too.
  let memory = 0;
  const read = () => {
    try {
      const n = Number.parseInt(store?.getItem(key) ?? "", 10);
      return Number.isFinite(n) && n >= 0 ? Math.max(n, memory) : memory;
    } catch {
      return memory;
    }
  };
  const write = (n: number) => {
    memory = n;
    try {
      store?.setItem(key, String(n));
    } catch {
      // The in-memory count still holds the cap for this page.
    }
  };
  return {
    limit: cap,
    left: () => Math.max(0, cap - read()),
    take() {
      const used = read();
      if (used >= cap) return false;
      write(used + 1);
      return true;
    },
  };
}
