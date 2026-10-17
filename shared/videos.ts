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

import type { Level } from "./pose";
import { LOWER_LEVELS, legacyLevel, type LimbLevel } from "./limbs";

export type VideoSource = "clinician" | "clinical_trial" | "rehab_channel" | "humanitarian" | "manufacturer";

export type ExerciseVideo = {
  youtubeId: string;
  title: string;
  channel: string;
  source: VideoSource;
  /** Exercise in shared/exercises.ts, or "general" for an overview. */
  exerciseId: string;
  /** Amputation levels the demonstration fits. */
  levels: Level[];
  seconds: number;
};

export const exerciseVideos: ExerciseVideo[] = [
  { youtubeId: "IWfo3Kc5gQY", title: "Bridging over bolster (below knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "bridging", levels: ["below_knee", "none"], seconds: 127 },
  { youtubeId: "MD5j-NixeOA", title: "Bridges (above knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "bridging", levels: ["above_knee"], seconds: 134 },
  { youtubeId: "c54GZqVlCNA", title: "Prone hip extension (below knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "prone-hip-extension", levels: ["below_knee", "none"], seconds: 108 },
  { youtubeId: "NKrjKj83d2A", title: "Prone hip extension (above knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "prone-hip-extension", levels: ["above_knee"], seconds: 91 },
  { youtubeId: "nbCsIXq0AIk", title: "Side-lying hip abduction, modified (below knee)", channel: "Mark Maguire, CPO", source: "clinician", exerciseId: "side-lying-abduction", levels: ["below_knee", "above_knee", "none"], seconds: 110 },
  { youtubeId: "IrS2NQn_sx8", title: "Sit to stand (HAMLET trial rehabilitation)", channel: "Vascular Research UK", source: "clinical_trial", exerciseId: "sit-to-stand", levels: ["above_knee", "below_knee", "none"], seconds: 59 },
  { youtubeId: "G2GkZu85pj4", title: "Sit-to-stand for one-leg amputees", channel: "Mission Gait", source: "rehab_channel", exerciseId: "sit-to-stand", levels: ["below_knee", "above_knee", "none"], seconds: 346 },
  { youtubeId: "sAT60CsGcNY", title: "General exercises (HAMLET trial rehabilitation)", channel: "Vascular Research UK", source: "clinical_trial", exerciseId: "general", levels: ["above_knee", "below_knee", "none"], seconds: 69 },
  { youtubeId: "qzA201RmQDI", title: "Exercises after amputation", channel: "Early Rehabilitation in Conflicts and Disasters", source: "humanitarian", exerciseId: "general", levels: ["below_knee", "above_knee", "none"], seconds: 499 },
];

/** Best video for an exercise and amputation level: exact level first, trial and clinician sources first. */
export function videoFor(exerciseId: string, limbLevel: Level | LimbLevel): ExerciseVideo | null {
  // Videos are listed by the older two leg levels; arm levels have no verified video yet (MED-01).
  const level: Level | null =
    limbLevel === "none" ? "none" : (LOWER_LEVELS as readonly string[]).includes(limbLevel) ? legacyLevel({ site: "lower", side: "left", level: limbLevel as LimbLevel }) : null;
  if (!level) return null;
  const rank: Record<VideoSource, number> = { clinical_trial: 0, clinician: 1, rehab_channel: 2, humanitarian: 3, manufacturer: 4 };
  const matches = exerciseVideos.filter((v) => v.exerciseId === exerciseId && v.levels.includes(level));
  return matches.sort((a, b) => a.levels.indexOf(level) - b.levels.indexOf(level) || rank[a.source] - rank[b.source])[0] ?? null;
}

export const thumbnailUrl = (v: ExerciseVideo) => `https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`;
/** Privacy-enhanced embed: no YouTube cookies until the viewer presses play. */
export const embedUrl = (v: ExerciseVideo, lang: string) =>
  `https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&modestbranding=1&playsinline=1&cc_load_policy=1&hl=${lang}&cc_lang_pref=${lang}`;
export const watchUrl = (v: ExerciseVideo) => `https://www.youtube.com/watch?v=${v.youtubeId}`;
