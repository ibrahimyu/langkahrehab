// DRAFT exercise content for testing the coach. Not clinically reviewed yet:
// a physiotherapist must review wording, doses and safety notes before real use.
// Wording is deliberately simple: short sentences, everyday words.

import { LOWER_LEVELS, UPPER_LEVELS, elbowLost, kneeLost, limbsOf, yourLimb, type Limb, type LimbLevel } from "./limbs";
import type { Level, Side } from "./pose";

export const LANGS = ["id", "en", "zh"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { id: "Bahasa Indonesia", en: "English", zh: "简体中文" };
type Text = Record<Lang, string>;

/** Starting position, for grouping in the clinician's picker (FIS-04). */
export const POSITIONS = ["lying", "side_lying", "prone", "sitting"] as const;
export type Position = (typeof POSITIONS)[number];

export type Exercise = {
  id: string;
  name: Text;
  /** Leg, arm, or either (DAT-14). */
  site: "lower" | "upper" | "any";
  /** Amputation levels the exercise is written for. A tester without an amputation gets the leg exercises. */
  levels: LimbLevel[];
  position: Position;
  /** Needs a knee on the amputated side: not for through-knee, above-knee or hip. */
  needsKnee: boolean;
  /** Needs an elbow on the amputated side: not for through-elbow, above-elbow or shoulder. */
  needsElbow: boolean;
  /**
   * A few short sentences the coach can use to explain the movement. {leg}, {arm} and {limb} are
   * filled from the profile by howTo ("your left leg"); the body is never labelled.
   */
  instructions: Text;
  /** The words the coach says during each rep, in order (e.g. lift, hold, lower). */
  tempo: Text;
  sets: number;
  reps: number;
  holdSeconds: number;
  restSeconds: number;
};

export const exercises: Exercise[] = [
  {
    id: "bridging",
    name: { en: "Bridging", id: "Angkat pinggul (bridging)", zh: "臀桥" },
    site: "lower",
    levels: [...LOWER_LEVELS],
    position: "lying",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Lie on your back with your other knee bent. Rest {leg} on a rolled towel. Squeeze your bottom and lift your hips. Hold, then lower slowly.",
      id: "Berbaring telentang, lutut kaki satunya ditekuk. Taruh {leg} di atas handuk gulung. Kencangkan bokong, angkat pinggul. Tahan, lalu turunkan pelan-pelan.",
      zh: "平躺，另一条腿的膝盖弯起来。{leg}放在卷起的毛巾上。夹紧屁股，把臀部抬起来。停一下，再慢慢放下。",
    },
    tempo: { en: "lift, hold, lower", id: "angkat, tahan, turun", zh: "抬起，停住，放下" },
    sets: 2,
    reps: 10,
    holdSeconds: 3,
    restSeconds: 30,
  },
  {
    id: "side-lying-abduction",
    name: { en: "Side leg lift", id: "Angkat kaki ke samping", zh: "侧躺抬腿" },
    site: "lower",
    levels: LOWER_LEVELS.filter((l) => l !== "hip"),
    position: "side_lying",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Lie on your side with {leg} on top. Lift it up towards the ceiling. Hold, then lower slowly.",
      id: "Berbaring miring, {leg} di atas. Angkat ke atas. Tahan, lalu turunkan pelan-pelan.",
      zh: "侧躺，{leg}在上面。把它往上抬。停一下，再慢慢放下。",
    },
    tempo: { en: "lift, hold, lower", id: "angkat, tahan, turun", zh: "抬起，停住，放下" },
    sets: 2,
    reps: 10,
    holdSeconds: 2,
    restSeconds: 30,
  },
  {
    id: "prone-hip-extension",
    name: { en: "Back leg lift (on your stomach)", id: "Angkat kaki ke belakang (tengkurap)", zh: "趴着抬腿" },
    site: "lower",
    levels: LOWER_LEVELS.filter((l) => l !== "hip"),
    position: "prone",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Lie on your stomach. Keep {leg} straight and lift it a little off the floor. Hold, then lower slowly. Keep your hips down.",
      id: "Berbaring tengkurap. Luruskan {leg}, angkat sedikit dari lantai. Tahan, lalu turunkan pelan-pelan. Pinggul tetap di lantai.",
      zh: "趴下。{leg}伸直，从地上稍微抬起来。停一下，再慢慢放下。屁股贴着地面。",
    },
    tempo: { en: "lift, hold, lower", id: "angkat, tahan, turun", zh: "抬起，停住，放下" },
    sets: 2,
    reps: 10,
    holdSeconds: 3,
    restSeconds: 30,
  },
  {
    id: "sit-to-stand",
    name: { en: "Sit to stand", id: "Duduk lalu berdiri", zh: "扶着站起来" },
    site: "lower",
    levels: [...LOWER_LEVELS],
    position: "sitting",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Sit at the front of a strong chair with a walker in front of you. Lean forward and push up to stand. Then sit down slowly.",
      id: "Duduk di ujung kursi yang kuat, walker di depan Anda. Condongkan badan ke depan, lalu dorong untuk berdiri. Duduk lagi pelan-pelan.",
      zh: "坐在结实椅子的前边，助行器放在前面。身体往前倾，用力站起来。再慢慢坐下。",
    },
    tempo: { en: "stand, sit", id: "berdiri, duduk", zh: "站起，坐下" },
    sets: 2,
    reps: 8,
    holdSeconds: 0,
    restSeconds: 45,
  },
  {
    id: "seated-knee-straighten",
    name: { en: "Knee straightening (sitting)", id: "Meluruskan lutut (duduk)", zh: "坐着伸膝" },
    site: "lower",
    levels: ["toe", "partial_foot", "ankle", "below_knee"],
    position: "sitting",
    needsKnee: true,
    needsElbow: false,
    instructions: {
      en: "Sit tall on a chair. Slowly straighten {leg} at the knee. Hold, then bend it back slowly.",
      id: "Duduk tegak di kursi. Luruskan {leg} pelan-pelan dari lutut. Tahan, lalu tekuk lagi pelan-pelan.",
      zh: "坐直在椅子上。慢慢把{leg}从膝盖伸直。停一下，再慢慢弯回来。",
    },
    tempo: { en: "straighten, hold, bend", id: "luruskan, tahan, tekuk", zh: "伸直，停住，弯回" },
    sets: 2,
    reps: 10,
    holdSeconds: 3,
    restSeconds: 30,
  },
  // Arm and hand (PAS-20): shoulder movement, elbow strength, gentle touch, posture, one-hand tasks.
  {
    id: "shoulder-blade-squeeze",
    name: { en: "Shoulder blade squeeze", id: "Merapatkan tulang belikat", zh: "夹肩胛骨" },
    site: "upper",
    levels: [...UPPER_LEVELS],
    position: "sitting",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Sit tall with your shoulders relaxed. Gently squeeze your shoulder blades back and together. Hold, then relax.",
      id: "Duduk tegak, bahu rileks. Tarik kedua tulang belikat ke belakang dan rapatkan pelan-pelan. Tahan, lalu lemaskan.",
      zh: "坐直，肩膀放松。轻轻把两边肩胛骨往后夹紧。停一下，再放松。",
    },
    tempo: { en: "squeeze, hold, relax", id: "rapatkan, tahan, lemaskan", zh: "夹紧，停住，放松" },
    sets: 2,
    reps: 10,
    holdSeconds: 3,
    restSeconds: 30,
  },
  {
    id: "arm-raise-forward",
    name: { en: "Arm raise", id: "Angkat lengan ke depan", zh: "向前抬手臂" },
    site: "upper",
    levels: UPPER_LEVELS.filter((l) => l !== "shoulder"),
    position: "sitting",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Sit tall. Lift {arm} forward and up as far as is comfortable. Hold, then lower slowly. Keep your shoulder down.",
      id: "Duduk tegak. Angkat {arm} ke depan dan ke atas sejauh nyaman. Tahan, lalu turunkan pelan-pelan. Bahu tetap turun.",
      zh: "坐直。把{arm}向前、向上抬到舒服的高度。停一下，再慢慢放下。肩膀不要耸起来。",
    },
    tempo: { en: "lift, hold, lower", id: "angkat, tahan, turun", zh: "抬起，停住，放下" },
    sets: 2,
    reps: 10,
    holdSeconds: 2,
    restSeconds: 30,
  },
  {
    id: "elbow-bend",
    name: { en: "Elbow bend", id: "Menekuk siku", zh: "弯肘" },
    site: "upper",
    levels: ["finger", "partial_hand", "wrist", "below_elbow"],
    position: "sitting",
    needsKnee: false,
    needsElbow: true,
    instructions: {
      en: "Sit tall with {arm} by your side. Bend at the elbow as far as is comfortable, then straighten it slowly.",
      id: "Duduk tegak, {arm} di samping badan. Tekuk siku sejauh nyaman, lalu luruskan pelan-pelan.",
      zh: "坐直，{arm}放在身体旁边。弯曲手肘到舒服的位置，再慢慢伸直。",
    },
    tempo: { en: "bend, straighten", id: "tekuk, luruskan", zh: "弯曲，伸直" },
    sets: 2,
    reps: 10,
    holdSeconds: 0,
    restSeconds: 30,
  },
  {
    id: "gentle-touch",
    name: { en: "Gentle touch", id: "Sentuhan lembut", zh: "轻柔触摸" },
    site: "any",
    levels: [...LOWER_LEVELS, ...UPPER_LEVELS],
    position: "sitting",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Only on healed skin. Sit comfortably. Gently stroke {limb} with a soft cloth, from the top down to the end. Then tap it lightly with your fingertips.",
      id: "Hanya pada kulit yang sudah sembuh. Duduk dengan nyaman. Usap {limb} pelan-pelan dengan kain lembut, dari atas sampai ujung. Lalu tepuk ringan dengan ujung jari.",
      zh: "只在已经愈合的皮肤上做。舒服地坐好。用软布从上到下轻轻抚摸{limb}。再用指尖轻轻拍一拍。",
    },
    tempo: { en: "stroke, tap", id: "usap, tepuk", zh: "抚摸，轻拍" },
    sets: 1,
    reps: 10,
    holdSeconds: 0,
    restSeconds: 30,
  },
  {
    id: "one-hand-practice",
    name: { en: "One-hand practice", id: "Latihan satu tangan", zh: "单手练习" },
    site: "upper",
    levels: [...UPPER_LEVELS],
    position: "sitting",
    needsKnee: false,
    needsElbow: false,
    instructions: {
      en: "Choose one everyday task, such as buttoning a shirt or opening a jar held between your knees. Do it slowly with your other hand. Each try counts as one.",
      id: "Pilih satu kegiatan sehari-hari, misalnya mengancingkan baju atau membuka toples yang dijepit di antara lutut. Lakukan pelan-pelan dengan tangan satunya. Setiap percobaan dihitung satu.",
      zh: "选一件日常小事，比如扣扣子，或者把罐子夹在两膝之间打开。用另一只手慢慢做。每试一次算一下。",
    },
    tempo: { en: "try, rest", id: "coba, istirahat", zh: "试一下，休息" },
    sets: 1,
    reps: 5,
    holdSeconds: 0,
    restSeconds: 60,
  },
];

export const exerciseById = (id: string) => exercises.find((e) => e.id === id);


type ProfileLike = { level: Level; side: Side; limbs?: Limb[] };

/** Whether an exercise is written for at least one of the patient's limbs. */
export function fitsLimbs(e: Exercise, limbs: Limb[]): boolean {
  if (!limbs.length) return e.site !== "upper";
  return limbs.some((l) => (e.site === "any" || e.site === l.site) && e.levels.includes(l.level));
}

/** Why an exercise does not fit the patient, for the clinician's picker; null when it fits. */
export function misfit(e: Exercise, limbs: Limb[]): "needs_knee" | "needs_elbow" | "other_limb" | null {
  if (fitsLimbs(e, limbs)) return null;
  if (e.needsKnee && limbs.some(kneeLost)) return "needs_knee";
  if (e.needsElbow && limbs.some(elbowLost)) return "needs_elbow";
  return "other_limb";
}

/** The instructions with the patient's own limb filled in ("your left leg", "lengan kanan Anda"). */
export function howTo(e: Exercise, lang: Lang, p: ProfileLike): string {
  const limbs = limbsOf(p);
  const leg: Limb = { side: limbs.find((l) => l.site === "lower")?.side ?? p.side, site: "lower", level: "below_knee" };
  const arm: Limb = { side: limbs.find((l) => l.site === "upper")?.side ?? p.side, site: "upper", level: "below_elbow" };
  const own = e.site === "any" ? limbs[0] : limbs.find((l) => l.site === e.site);
  return e.instructions[lang]
    .replaceAll("{leg}", yourLimb(lang, leg))
    .replaceAll("{arm}", yourLimb(lang, arm))
    .replaceAll("{limb}", yourLimb(lang, own ?? (e.site === "upper" ? arm : leg)));
}

/** First sentence of a text, for the picker. */
export const firstSentence = (text: string) => text.split(/(?<=[.!?。])\s*/)[0] ?? text;
