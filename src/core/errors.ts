/**
 * Turn the errors Firebase, Chrome and the network throw into a sentence a
 * person can act on. The original text stays at the end, in brackets, so a
 * bug report still carries it.
 */
export interface ErrorContext {
  /** A check of one text that went to the cloud because this browser has no on-device model. */
  cloudCheck?: boolean;
}

export function friendlyError(err: unknown, ctx: ErrorContext = {}): string {
  const raw = errorText(err);
  const msg = raw.toLowerCase();
  const say = (human: string) => (raw && raw !== human ? `${human} (${shorten(raw)})` : human);

  if ((err as { name?: string } | null)?.name === "AbortError" || msg.includes("compile cancelled")) return "Stopped.";
  if (msg.includes("appcheck") || msg.includes("app-check") || msg.includes("app check")) {
    if (msg.includes("throttl"))
      return say(
        "Firebase App Check turned this browser away earlier and is waiting before it tries again. Reload the page in a normal Chrome window (not a headless or automated one), or try again later.",
      );
    return say("Firebase App Check could not confirm this browser, so Gemini refused the call. Reload the page and try again.");
  }
  if (msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("429") || msg.includes("rate limit"))
    return say("Gemini in the cloud is busy or out of free quota right now. Wait a minute and try again.");
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network error") || msg.includes("err_internet_disconnected"))
    return say(
      ctx.cloudCheck
        ? "This browser has no on-device model, so this check runs in the cloud, and the connection dropped. Try again when you are back online."
        : "Compiling needs the internet, and the connection dropped. Running a compiled cantrip does not.",
    );
  if (msg.includes("did not answer within"))
    return say("Gemini in the cloud took too long to answer. Try again in a minute.");
  if (msg.includes("label outside the program"))
    return say("The on-device model gave an answer outside this cantrip's labels. Run it again: Gemini Nano is not deterministic.");
  if (msg.includes("languagemodel") || msg.includes("on-device model") || msg.includes("on device model"))
    return say("Gemini Nano is not ready in this Chrome. Check chrome://on-device-internals, then reload.");
  return raw || "Something went wrong.";
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message.trim();
  if (typeof err === "string") return err.trim();
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message).trim();
  return err == null ? "" : String(err);
}

function shorten(s: string, max = 160): string {
  // Request URLs say nothing a person can act on, and they are long enough to break a phone layout.
  const flat = s.replace(/https?:\/\/\S+/g, "…").replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1) + "…";
}
