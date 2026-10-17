// Amputation location for every limb (DAT-14, PAS-20): leg or arm, either side, at any level,
// one or more limbs. Profile.level/side stay as derived fields (the first leg) so pose tracking,
// the coach and older stored data keep working during the migration.

import type { Lang } from "./exercises";
import type { Level, Side } from "./pose";

export const LIMB_SITES = ["lower", "upper"] as const;
export type LimbSite = (typeof LIMB_SITES)[number];
export const LOWER_LEVELS = ["toe", "partial_foot", "ankle", "below_knee", "knee", "above_knee", "hip"] as const;
export const UPPER_LEVELS = ["finger", "partial_hand", "wrist", "below_elbow", "elbow", "above_elbow", "shoulder"] as const;
export type LowerLevel = (typeof LOWER_LEVELS)[number];
export type UpperLevel = (typeof UPPER_LEVELS)[number];
export type LimbLevel = LowerLevel | UpperLevel;
export type Limb = { site: LimbSite; side: Side; level: LimbLevel };

export const MAX_LIMBS = 4;
export const levelsFor = (site: LimbSite): readonly LimbLevel[] => (site === "lower" ? LOWER_LEVELS : UPPER_LEVELS);

/** Levels with no knee joint left on that side (through-knee and higher). */
const NO_KNEE: readonly LimbLevel[] = ["knee", "above_knee", "hip"];
/** Levels with no elbow joint left on that side (through-elbow and higher). */
const NO_ELBOW: readonly LimbLevel[] = ["elbow", "above_elbow", "shoulder"];
export const kneeLost = (l: Limb) => l.site === "lower" && NO_KNEE.includes(l.level);
export const elbowLost = (l: Limb) => l.site === "upper" && NO_ELBOW.includes(l.level);

/** The older two-level value used by pose tracking and the video list; null for an arm. */
export const legacyLevel = (l: Limb): Exclude<Level, "none"> | null =>
  l.site !== "lower" ? null : NO_KNEE.includes(l.level) ? "above_knee" : "below_knee";

/** Limbs from a profile, also for profiles stored before `limbs` existed. A tester has none. */
export function limbsOf(p: { level: Level; side: Side; limbs?: Limb[] }): Limb[] {
  if (p.limbs?.length) return p.limbs;
  return p.level === "none" ? [] : [{ site: "lower", side: p.side, level: p.level }];
}

/** Derived legacy fields: the first leg; for arms only, "none" with the exercising leg (pose = intact legs). */
export function legacyFields(limbs: Limb[], fallbackSide: Side = "left"): { level: Level; side: Side } {
  const leg = limbs.find((l) => l.site === "lower");
  if (leg) return { level: legacyLevel(leg)!, side: leg.side };
  return { level: "none", side: limbs[0]?.side ?? fallbackSide };
}

export function sanitizeLimbs(raw: unknown): Limb[] {
  if (!Array.isArray(raw)) return [];
  const out: Limb[] = [];
  for (const r of raw as any[]) {
    const site: LimbSite | null = r?.site === "upper" || r?.site === "lower" ? r.site : null;
    const side: Side | null = r?.side === "left" || r?.side === "right" ? r.side : null;
    if (!site || !side || !levelsFor(site).includes(r?.level)) continue;
    if (out.some((l) => l.site === site && l.side === side)) continue;
    out.push({ site, side, level: r.level });
    if (out.length >= MAX_LIMBS) break;
  }
  return out;
}

type Text = Record<Lang, string>;

/** Clinical level names for the care team and the profile line. */
export const LEVEL_NAMES: Record<LimbLevel, Text> = {
  toe: { en: "Toe", id: "Jari kaki", zh: "脚趾" },
  partial_foot: { en: "Partial foot", id: "Sebagian telapak kaki", zh: "部分足" },
  ankle: { en: "Ankle (Syme)", id: "Pergelangan kaki (Syme)", zh: "踝部（Syme）" },
  below_knee: { en: "Below knee", id: "Bawah lutut", zh: "膝下" },
  knee: { en: "Through knee", id: "Sendi lutut", zh: "膝关节离断" },
  above_knee: { en: "Above knee", id: "Atas lutut", zh: "膝上" },
  hip: { en: "Hip", id: "Sendi panggul", zh: "髋关节离断" },
  finger: { en: "Finger", id: "Jari tangan", zh: "手指" },
  partial_hand: { en: "Partial hand", id: "Sebagian tangan", zh: "部分手掌" },
  wrist: { en: "Wrist", id: "Pergelangan tangan", zh: "腕关节离断" },
  below_elbow: { en: "Below elbow", id: "Bawah siku", zh: "肘下" },
  elbow: { en: "Through elbow", id: "Sendi siku", zh: "肘关节离断" },
  above_elbow: { en: "Above elbow", id: "Atas siku", zh: "肘上" },
  shoulder: { en: "Shoulder", id: "Bahu", zh: "肩关节离断" },
};

const SIDE: Record<Side, Text> = { left: { en: "left", id: "kiri", zh: "左" }, right: { en: "right", id: "kanan", zh: "右" } };
type Part = "leg" | "foot" | "arm" | "hand";
const PART: Record<Part, Text> = {
  leg: { en: "leg", id: "kaki", zh: "腿" },
  foot: { en: "foot", id: "telapak kaki", zh: "脚" },
  arm: { en: "arm", id: "lengan", zh: "手臂" },
  hand: { en: "hand", id: "tangan", zh: "手" },
};
const partOf = (l: Limb): Part =>
  l.site === "lower" ? (["toe", "partial_foot", "ankle"].includes(l.level) ? "foot" : "leg") : ["finger", "partial_hand", "wrist"].includes(l.level) ? "hand" : "arm";

/** "left leg", "kaki kiri", "左腿": the body part, never a label for it. */
export function limbName(lang: Lang, l: Pick<Limb, "site" | "side" | "level">): string {
  const s = SIDE[l.side][lang];
  const part = PART[partOf(l as Limb)][lang];
  return lang === "en" ? `${s} ${part}` : lang === "id" ? `${part} ${s}` : `${s}${part}`;
}

/** "your left leg", "kaki kiri Anda", "左腿": for instructions spoken to the patient. */
export function yourLimb(lang: Lang, l: Limb): string {
  const n = limbName(lang, l);
  return lang === "en" ? `your ${n}` : lang === "id" ? `${n} Anda` : n;
}

/** One line per limb for the care team: "Below elbow, right arm". */
export const limbLine = (lang: Lang, l: Limb) =>
  lang === "zh" ? `${limbName(lang, l)}${LEVEL_NAMES[l.level].zh}` : `${LEVEL_NAMES[l.level][lang]}, ${limbName(lang, l)}`;

/** Plain English for prompts: "below-elbow amputation of the right arm". */
const PROMPT_LEVEL: Record<LimbLevel, string> = {
  toe: "toe amputation", partial_foot: "partial-foot amputation", ankle: "ankle (Syme) amputation", below_knee: "below-knee amputation",
  knee: "through-knee amputation (knee disarticulation)", above_knee: "above-knee amputation", hip: "hip disarticulation",
  finger: "finger amputation", partial_hand: "partial-hand amputation", wrist: "wrist disarticulation", below_elbow: "below-elbow amputation",
  elbow: "through-elbow amputation (elbow disarticulation)", above_elbow: "above-elbow amputation", shoulder: "shoulder disarticulation",
};
export const limbEnglish = (l: Limb) => `${PROMPT_LEVEL[l.level]}, ${limbName("en", l)}`;
