/**
 * Sharing a cantrip through Firestore. A shared cantrip carries its rule,
 * its tests and every program compiled for it. Whoever installs it on a
 * device with a different model recompiles it there, starting from the
 * program that already works elsewhere.
 */
import type { FirebaseApp } from "firebase/app";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import type { Cantrip, CompiledProgram, Target } from "../core/types";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function makeShareCode(rand: () => number = Math.random): string {
  return Array.from({ length: 7 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join("");
}

/** Keep shared documents small: rounds keep their scores, not every test transcript. */
export function slimForSharing(c: Cantrip) {
  const programs: Partial<Record<Target, Omit<CompiledProgram, "rounds" | "holdoutResults"> & { roundScores: number[] }>> = {};
  for (const [target, p] of Object.entries(c.programs) as [Target, CompiledProgram][]) {
    const { rounds, holdoutResults: _h, ...rest } = p;
    programs[target] = { ...rest, roundScores: rounds.map((r) => r.accuracy) };
  }
  return { spec: c.spec, tests: c.tests, programs };
}

export function fromShared(code: string, data: ReturnType<typeof slimForSharing>, newId: string): Cantrip {
  const programs: Cantrip["programs"] = {};
  for (const [target, p] of Object.entries(data.programs ?? {}) as [Target, ReturnType<typeof slimForSharing>["programs"]["gemini-nano"]][]) {
    if (!p) continue;
    const { roundScores, ...rest } = p;
    programs[target] = {
      ...rest,
      holdoutResults: [],
      rounds: (roundScores ?? []).map((accuracy, i) => ({ round: i + 1, kind: i === 0 ? "design" : "repair", program: rest.program, results: [], accuracy })),
    };
  }
  const now = Date.now();
  return { id: newId, spec: data.spec, tests: data.tests, programs, enabled: true, createdAt: now, updatedAt: now, shareCode: code };
}

export async function publishCantrip(app: FirebaseApp, c: Cantrip, uid: string): Promise<string> {
  const db = getFirestore(app);
  const code = c.shareCode ?? makeShareCode();
  await setDoc(doc(db, "shared", code), { ...slimForSharing(c), author: uid, createdAt: serverTimestamp(), app: "cantrip/1" });
  return code;
}

export async function fetchShared(app: FirebaseApp, code: string, newId: string): Promise<Cantrip | null> {
  const clean = code.trim().toLowerCase();
  if (!/^[a-z0-9]{7}$/.test(clean)) return null;
  const snap = await getDoc(doc(getFirestore(app), "shared", clean));
  if (!snap.exists()) return null;
  return fromShared(clean, snap.data() as ReturnType<typeof slimForSharing>, newId);
}
