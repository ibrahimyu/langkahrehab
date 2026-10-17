// Movement quality from the camera: each counted rep gets a 0–100 score for range, hold and pace.
// The score is feedback for the patient and a trend for the physio, never a clinical measure.

import type { RepEvent } from "./pose";

export type FormPart = "range" | "hold" | "pace";
export type RepScore = { score: number; range: number; hold: number; pace: number; weakest: FormPart | null };
export type FormTarget = { up: number; down: number; holdMs: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** A rep that only just crosses the top threshold earns 70% of the range score; full range is half a band further. */
const FULL_RANGE_EXTRA = 0.5;
/** Shortest rep that still counts as controlled, on top of the hold. */
const MIN_CONTROLLED_MS = 1500;
const WEAK = 0.75;

export function scoreRep(e: Pick<RepEvent, "peak" | "heldMs" | "durationMs">, t: FormTarget): RepScore {
  const band = Math.abs(t.up - t.down) || 1;
  const dir = t.up >= t.down ? 1 : -1;
  const full = t.up + dir * band * FULL_RANGE_EXTRA;
  const range = clamp01(0.7 + 0.3 * ((e.peak - t.up) * dir) / (Math.abs(full - t.up) || 1));
  const hold = t.holdMs > 0 ? clamp01(e.heldMs / t.holdMs) : 1;
  const pace = clamp01(e.durationMs / (t.holdMs + MIN_CONTROLLED_MS));
  const weights = t.holdMs > 0 ? { range: 0.45, hold: 0.35, pace: 0.2 } : { range: 0.6, hold: 0, pace: 0.4 };
  const score = Math.round(100 * (weights.range * range + weights.hold * hold + weights.pace * pace));
  const parts: [FormPart, number][] = [["range", range], ["hold", t.holdMs > 0 ? hold : 1], ["pace", pace]];
  const [weakPart, weakValue] = parts.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { score, range, hold, pace, weakest: weakValue < WEAK ? weakPart : null };
}

export const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export type FormBand = "great" | "good" | "steady" | "slow_down";
export function formBand(score: number): FormBand {
  return score >= 85 ? "great" : score >= 70 ? "good" : score >= 50 ? "steady" : "slow_down";
}

/** The part that most often held reps back across a set or session, if any. */
export function mainTip(reps: RepScore[]): FormPart | null {
  const counts = new Map<FormPart, number>();
  for (const r of reps) if (r.weakest) counts.set(r.weakest, (counts.get(r.weakest) ?? 0) + 1);
  let best: FormPart | null = null;
  for (const [part, n] of counts) if (n * 3 >= reps.length && (!best || n > counts.get(best)!)) best = part;
  return best;
}

/** Session score from the per-set scores saved with each exercise. */
export function sessionForm(exercises: { form?: (number | null)[] }[]): number | null {
  return average(exercises.flatMap((e) => (e.form ?? []).filter((x): x is number => x !== null)));
}
