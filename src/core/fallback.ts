import type { JsonModel, JsonResult, JsonSchema } from "./types";

export interface FallbackOptions {
  /** Give up on the first model after this long. Cloud models can hang for a minute before failing when they are overloaded. */
  timeoutMs?: number;
  /** Called when the second model takes over, with the first model's error. */
  onFallback?: (error: Error) => void;
}

/**
 * Try one model, and use a second one when the first fails or takes too long.
 * If both fail, the first model's error is the one reported, because that is
 * the one the person can act on.
 */
export function withFallback(primary: JsonModel, fallback: JsonModel, opts: FallbackOptions = {}): JsonModel {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  return {
    async generateJson(prompt: string, schema: JsonSchema): Promise<JsonResult> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          primary.generateJson(prompt, schema),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`The model did not answer within ${Math.round(timeoutMs / 1000)} seconds.`)), timeoutMs);
          }),
        ]);
      } catch (err) {
        const first = err instanceof Error ? err : new Error(String(err));
        opts.onFallback?.(first);
        try {
          return await fallback.generateJson(prompt, schema);
        } catch {
          throw first;
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
