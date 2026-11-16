/**
 * Copy text without letting the clipboard hold anything up. In Chrome,
 * navigator.clipboard.writeText can stay pending forever when the page is not
 * focused, so the caller gets an answer within a short time either way.
 */
export async function copyWithoutBlocking(write: () => Promise<void> | undefined, timeoutMs = 800): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const attempt = write();
    if (!attempt) return false;
    return await Promise.race([
      attempt.then(() => true, () => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
