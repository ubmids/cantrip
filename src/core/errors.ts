/**
 * Turn the errors Firebase, Chrome and the network throw into a sentence a
 * person can act on. The original text is kept apart, for a "details"
 * disclosure, so a bug report still carries it without a person having to
 * read it.
 */
export interface ErrorContext {
  /** A check of one text that went to the cloud because this browser has no on-device model. */
  cloudCheck?: boolean;
}

export interface ExplainedError {
  /** What a person reads: what happened and what to do. Never the SDK's own text. */
  message: string;
  /** The original error, shortened, for a "details" disclosure or a bug report. */
  details?: string;
  /** False when trying again in this browser cannot help, so the UI offers no "Try again". */
  retry: boolean;
  /** Firebase turned this browser away (App Check). Another browser window, or the video, is the way on. */
  refused?: true;
}

/** The advice for a browser Firebase App Check turned away. A reload does not help, so it never says to reload. */
const REFUSED_ADVICE =
  "Reloading will not help. Open the site in another normal browser window (not a headless or automated one), or watch the demo video.";

export function explainError(err: unknown, ctx: ErrorContext = {}): ExplainedError {
  const raw = errorText(err);
  const msg = raw.toLowerCase();
  const out = (message: string, retry = true): ExplainedError =>
    raw && raw !== message ? { message, details: shorten(raw), retry } : { message, retry };
  const refused = (message: string): ExplainedError => ({ ...out(`${message} ${REFUSED_ADVICE}`, false), refused: true });
  const call = ctx.cloudCheck ? "the cloud check" : "the call to Gemini";

  if ((err as { name?: string } | null)?.name === "AbortError" || msg.includes("compile cancelled")) return { message: "Stopped.", retry: true };
  const appCheck = msg.includes("appcheck") || msg.includes("app-check") || msg.includes("app check");
  if (appCheck && msg.includes("throttl"))
    return refused(`Firebase App Check turned this browser away earlier and will not let it ask again for a while, so ${call} was refused.`);
  // Firebase AI Logic answers "[401 ]" or "[403 ]" when App Check turns the browser away, whatever else the text says.
  if (appCheck || /\[\s*40[13][\s\]]|\b40[13] error\b/.test(msg))
    return refused(`Firebase App Check could not confirm this browser, so ${call} was refused.`);
  if (msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("429") || msg.includes("rate limit"))
    return out("Gemini in the cloud is busy or out of free quota right now. Wait a minute and try again.");
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network error") || msg.includes("err_internet_disconnected"))
    return out(
      ctx.cloudCheck
        ? "This browser has no on-device model, so this check runs in the cloud, and the connection dropped. Try again when you are back online."
        : "Compiling needs the internet, and the connection dropped. Running a compiled cantrip does not.",
    );
  if (msg.includes("did not answer within")) return out("Gemini in the cloud took too long to answer. Try again in a minute.");
  if (msg.includes("label outside the program"))
    return out("The on-device model gave an answer outside this cantrip's labels. Run it again: Gemini Nano is not deterministic.");
  if (msg.includes("languagemodel") || msg.includes("on-device model") || msg.includes("on device model"))
    return out("Gemini Nano is not ready in this Chrome. Check chrome://on-device-internals, then reload.");
  return { message: raw ? shorten(raw, 300) : "Something went wrong.", retry: true };
}

/**
 * The same as explainError, as one line for a toast: the sentence, then the original text in
 * brackets so a bug report still carries it.
 */
export function friendlyError(err: unknown, ctx: ErrorContext = {}): string {
  const e = explainError(err, ctx);
  return e.details ? `${e.message} (${e.details})` : e.message;
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
