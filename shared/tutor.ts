// The step-by-step tutor for one exercise: five chapters built from the exercise's own instructions,
// plus preparation, mistakes and stop signs that follow from its position and hold.

import { howTo, type Exercise, type Lang } from "./exercises";
import { t, type TextKey } from "./i18n";
import type { Level, Side } from "./pose";
import type { Limb } from "./limbs";

export const CHAPTERS = ["prepare", "start", "move", "mistakes", "stop"] as const;
export type Chapter = (typeof CHAPTERS)[number];
export const chapterTitle: Record<Chapter, TextKey> = { prepare: "tutPrepare", start: "tutStart", move: "tutMove", mistakes: "tutMistakes", stop: "tutStop" };

/** A common mistake and what to do instead. */
export type Mistake = { wrong: string; right: string };
export type TutorStep = {
  chapter: Chapter;
  /** Everything in the chapter as sentences (read aloud, and the plain view). */
  lines: string[];
  /** The movement as numbered steps (Movement chapter). */
  steps?: string[];
  /** Movement words in order, e.g. ["lift", "hold", "lower"] (Movement chapter). */
  tempo?: string[];
  holdSeconds?: number;
  mistakes?: Mistake[];
};

const sentences = (text: string) => text.split(/(?<=[.!?。])\s*/).map((x) => x.trim()).filter(Boolean);
/** "Holding your breath. Breathe out as you move." → the mistake, then the fix. */
const split = (text: string): Mistake => {
  const [wrong = "", ...rest] = sentences(text);
  return { wrong, right: rest.join(" ") };
};

export function tutorSteps(e: Exercise, lang: Lang, profile: { level: Level; side: Side; limbs?: Limb[] }): TutorStep[] {
  const [first = "", ...rest] = sentences(howTo(e, lang, profile));
  const hold = e.holdSeconds;
  const tempo = e.tempo[lang].split(/[,，、]\s*/).map((x) => x.trim()).filter(Boolean);
  const move = [...rest, t(lang, "tutTempo", { tempo: e.tempo[lang] })];
  if (hold > 0) move.push(t(lang, "tutHold", { n: hold }));
  const mistakeText = [t(lang, "tutMistakeBreath"), hold > 0 ? t(lang, "tutMistakeRushHold", { n: hold }) : t(lang, "tutMistakeFast")];
  if (e.position === "lying" || e.position === "prone") mistakeText.push(t(lang, "tutMistakeBack"));
  if (e.position === "sitting") mistakeText.push(t(lang, "tutMistakeLean"));
  return [
    { chapter: "prepare", lines: sentences(t(lang, `tutPrep_${e.position}` as TextKey)) },
    { chapter: "start", lines: [first] },
    { chapter: "move", lines: move, steps: rest.length ? rest : [first], tempo, holdSeconds: hold },
    { chapter: "mistakes", lines: mistakeText, mistakes: mistakeText.map(split) },
    { chapter: "stop", lines: [t(lang, "tutStop1"), t(lang, "tutStop2"), t(lang, "tutStop3")] },
  ];
}
