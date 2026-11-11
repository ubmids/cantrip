/** Parse model output that should be JSON but may arrive wrapped in a code fence or with stray prose. */
export function parseJsonLoose(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }
  const start = Math.min(
    ...["{", "["].map((c) => text.indexOf(c)).filter((i) => i >= 0),
  );
  if (Number.isFinite(start)) {
    const open = text[start];
    const close = open === "{" ? "}" : "]";
    const end = text.lastIndexOf(close);
    if (end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
  }
  throw new Error("Model did not return JSON");
}

export function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
