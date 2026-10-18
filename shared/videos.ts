// Exercise videos from clinical sources, embedded from YouTube (the owners allow embedding; checked
// with YouTube oEmbed on 16 Oct 2026). Each entry names its source honestly. None of these replace a
// physiotherapist's instruction, and the app says so next to every video.
// Sources:
//  - Mark Maguire, CPO: certified prosthetist-orthotist, one short clip per exercise and amputation level.
//  - Vascular Research UK, HAMLET trial (ISRCTN28683499, NIHR HTA, University of York): rehabilitation
//    videos made for a registered randomised trial (through-knee amputation). The trial runs until 2028,
//    so its results are not published yet.
//  - Mission Gait: physical therapist-led amputee rehabilitation channel.
//  - Early Rehabilitation in Conflicts and Disasters: humanitarian rehabilitation training series.
//  - Ottobock: prosthetics manufacturer, physiotherapist-led exercise videos.

import { exerciseById } from "./exercises";
import { UPPER_LEVELS, limbsOf, type Limb, type LimbLevel, type LimbSite } from "./limbs";
import type { Level, Side } from "./pose";

/** Leg levels that keep the knee, and those that do not: a clip filmed for one fits its whole group. */
const KNEE_KEPT: LimbLevel[] = ["below_knee", "ankle", "partial_foot", "toe"];
const KNEE_GONE: LimbLevel[] = ["above_knee", "knee", "hip"];
/** "none" = a tester without an amputation. */
type VideoLevel = LimbLevel | "none";

export type VideoSource = "clinician" | "clinical_trial" | "rehab_channel" | "humanitarian" | "manufacturer";

export type ExerciseVideo = {
  youtubeId: string;
  title: string;
  channel: string;
  source: VideoSource;
  /** Exercise in shared/exercises.ts, or "general" for an overview. */
  exerciseId: string;
  /** Limb the demonstration is filmed for (DAT-14). */
  site: LimbSite;
  /** Amputation levels the demonstration fits, best fit first. */
  levels: VideoLevel[];
  seconds: number;
};

export const exerciseVideos: ExerciseVideo[] = [
  { youtubeId: "IWfo3Kc5gQY", title: "Bridging over bolster (below knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "bridging", site: "lower", levels: [...KNEE_KEPT, "none"], seconds: 127 },
  { youtubeId: "MD5j-NixeOA", title: "Bridges (above knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "bridging", site: "lower", levels: [...KNEE_GONE], seconds: 134 },
  { youtubeId: "c54GZqVlCNA", title: "Prone hip extension (below knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "prone-hip-extension", site: "lower", levels: [...KNEE_KEPT, "none"], seconds: 108 },
  { youtubeId: "NKrjKj83d2A", title: "Prone hip extension (above knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "prone-hip-extension", site: "lower", levels: [...KNEE_GONE], seconds: 91 },
  { youtubeId: "nbCsIXq0AIk", title: "Side-lying hip abduction, modified (below knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "side-lying-abduction", site: "lower", levels: [...KNEE_KEPT, ...KNEE_GONE, "none"], seconds: 110 },
  { youtubeId: "IrS2NQn_sx8", title: "Sit to stand (HAMLET trial rehabilitation)", channel: "Vascular Research UK", source: "clinical_trial", exerciseId: "sit-to-stand", site: "lower", levels: [...KNEE_GONE, ...KNEE_KEPT, "none"], seconds: 59 },
  { youtubeId: "G2GkZu85pj4", title: "Sit-to-stand for one-leg amputees", channel: "Mission Gait", source: "rehab_channel", exerciseId: "sit-to-stand", site: "lower", levels: [...KNEE_KEPT, ...KNEE_GONE, "none"], seconds: 346 },
  { youtubeId: "sAT60CsGcNY", title: "General exercises (HAMLET trial rehabilitation)", channel: "Vascular Research UK", source: "clinical_trial", exerciseId: "general", site: "lower", levels: [...KNEE_GONE, ...KNEE_KEPT, "none"], seconds: 69 },
  { youtubeId: "qzA201RmQDI", title: "Exercises after amputation", channel: "Early Rehabilitation in Conflicts and Disasters", source: "humanitarian", exerciseId: "general", site: "lower", levels: [...KNEE_KEPT, ...KNEE_GONE, "none"], seconds: 499 },
];

type Who = Level | LimbLevel | Limb | { level: Level; side: Side; limbs?: Limb[] };

/** The limb an exercise is done with for this patient: the first limb the exercise is written for. */
function limbFor(exerciseId: string, who: Who): { site: LimbSite; level: VideoLevel } | null {
  if (typeof who === "string") {
    if (who === "none") return { site: "lower", level: "none" };
    return { site: (UPPER_LEVELS as readonly string[]).includes(who) ? "upper" : "lower", level: who };
  }
  if ("site" in who) return { site: who.site, level: who.level };
  const limbs = limbsOf(who);
  const e = exerciseById(exerciseId);
  if (!limbs.length) return e?.site === "upper" ? null : { site: "lower", level: "none" };
  const own = limbs.find((l) => !e || ((e.site === "any" || e.site === l.site) && e.levels.includes(l.level))) ?? null;
  return own ? { site: own.site, level: own.level } : null;
}

/** Best video for an exercise and the patient's limb: same site, then the level it was filmed for, then the source. */
export function videoFor(exerciseId: string, who: Who): ExerciseVideo | null {
  const limb = limbFor(exerciseId, who);
  if (!limb) return null;
  const e = exerciseById(exerciseId);
  if (e && limb.level !== "none" && (!(e.site === "any" || e.site === limb.site) || !e.levels.includes(limb.level))) return null;
  const rank: Record<VideoSource, number> = { clinical_trial: 0, clinician: 1, rehab_channel: 2, humanitarian: 3, manufacturer: 4 };
  const matches = exerciseVideos.filter((v) => v.exerciseId === exerciseId && v.site === limb.site && v.levels.includes(limb.level));
  return matches.sort((a, b) => a.levels.indexOf(limb.level) - b.levels.indexOf(limb.level) || rank[a.source] - rank[b.source])[0] ?? null;
}

export const thumbnailUrl = (v: ExerciseVideo) => `https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`;
/** Privacy-enhanced embed: no YouTube cookies until the viewer presses play. */
export const embedUrl = (v: ExerciseVideo, lang: string) =>
  `https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&modestbranding=1&playsinline=1&cc_load_policy=1&hl=${lang}&cc_lang_pref=${lang}`;
export const watchUrl = (v: ExerciseVideo) => `https://www.youtube.com/watch?v=${v.youtubeId}`;
