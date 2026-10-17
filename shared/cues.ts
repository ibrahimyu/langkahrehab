// What the coach says after each rep the camera counts: praise when the rep was good, one short
// correction in the words of that exercise when it was not, and a nudge near the end of the set.

import type { Lang } from "./exercises";
import type { FormPart } from "./form";
import { t, type TextKey } from "./i18n";
import type { RepEvent } from "./pose";

const PRAISE: TextKey[] = ["cuePraise1", "cuePraise2", "cuePraise3", "cuePraise4"];
/** Exercises with their own words for "go further" (the body part that should move more). */
const RANGE_WORDS = new Set(["bridging", "side-lying-abduction", "prone-hip-extension", "sit-to-stand", "arm-raise-forward", "elbow-bend"]);

export function correction(part: FormPart, exerciseId: string, lang: Lang): string {
  if (part === "hold") return t(lang, "cueHoldLonger");
  if (part === "pace") return t(lang, "cueSlower");
  return RANGE_WORDS.has(exerciseId) ? t(lang, `cueRange_${exerciseId}` as TextKey) : t(lang, "cueRange");
}

/**
 * The line spoken after rep `e.count` of `target`. Corrections at most every `gapReps` reps, so a
 * patient who cannot go further is not told the same thing every time.
 */
export function repLine(e: Pick<RepEvent, "count" | "form">, target: number, exerciseId: string, lang: Lang, lastCorrectionAt: number | null, gapReps = 2): { text: string; corrected: boolean } {
  const n = e.count;
  const weak = e.form?.weakest ?? null;
  const canCorrect = weak && (lastCorrectionAt === null || n - lastCorrectionAt >= gapReps);
  const lead = `${n}.`;
  if (n >= target) return { text: `${lead} ${t(lang, "cuePraise4")}`, corrected: false };
  if (canCorrect) return { text: `${lead} ${correction(weak, exerciseId, lang)}`, corrected: true };
  if (n === target - 1) return { text: `${lead} ${t(lang, "cueOneMore")}`, corrected: false };
  if (target >= 6 && n === Math.floor(target / 2)) return { text: `${lead} ${t(lang, "cueHalf")}`, corrected: false };
  if (!weak && (e.form?.score ?? 0) >= 70) return { text: `${lead} ${t(lang, PRAISE[n % PRAISE.length]!)}`, corrected: false };
  return { text: lead, corrected: false };
}

/** Words for the hold at the top: "Hold it. 1, 2, 3. And down slowly." */
export function holdLines(seconds: number, lang: Lang): string[] {
  if (seconds <= 0) return [];
  return [t(lang, "cueHold"), ...Array.from({ length: seconds }, (_, i) => String(i + 1)), t(lang, "cueLower")];
}
