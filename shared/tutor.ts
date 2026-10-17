// The step-by-step tutor for one exercise: five chapters built from the exercise's own instructions,
// plus preparation, mistakes and stop signs that follow from its position and hold.

import { howTo, type Exercise, type Lang } from "./exercises";
import { t, type TextKey } from "./i18n";
import type { Level, Side } from "./pose";
import type { Limb } from "./limbs";

export const CHAPTERS = ["prepare", "start", "move", "mistakes", "stop"] as const;
export type Chapter = (typeof CHAPTERS)[number];
export const chapterTitle: Record<Chapter, TextKey> = { prepare: "tutPrepare", start: "tutStart", move: "tutMove", mistakes: "tutMistakes", stop: "tutStop" };

export type TutorStep = { chapter: Chapter; lines: string[] };

const sentences = (text: string) => text.split(/(?<=[.!?。])\s*/).map((x) => x.trim()).filter(Boolean);

export function tutorSteps(e: Exercise, lang: Lang, profile: { level: Level; side: Side; limbs?: Limb[] }): TutorStep[] {
  const [first = "", ...rest] = sentences(howTo(e, lang, profile));
  const hold = e.holdSeconds;
  const move = [...rest, t(lang, "tutTempo", { tempo: e.tempo[lang] })];
  if (hold > 0) move.push(t(lang, "tutHold", { n: hold }));
  const mistakes = [t(lang, "tutMistakeBreath"), hold > 0 ? t(lang, "tutMistakeRushHold", { n: hold }) : t(lang, "tutMistakeFast")];
  if (e.position === "lying" || e.position === "prone") mistakes.push(t(lang, "tutMistakeBack"));
  if (e.position === "sitting") mistakes.push(t(lang, "tutMistakeLean"));
  return [
    { chapter: "prepare", lines: [t(lang, `tutPrep_${e.position}` as TextKey)] },
    { chapter: "start", lines: [first] },
    { chapter: "move", lines: move },
    { chapter: "mistakes", lines: mistakes },
    { chapter: "stop", lines: [t(lang, "tutStop1"), t(lang, "tutStop2"), t(lang, "tutStop3")] },
  ];
}
