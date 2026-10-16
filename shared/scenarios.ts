// Guided scenarios for judges: each walks through a few steps of one prepared case.
// The patient's phone is always shown; the physio dashboard appears when switched on.

import type { Lang } from "./exercises";
import type { TextKey } from "./i18n";

export type StepKind = "meet" | "exercise" | "summary" | "next_day" | "skin" | "checkup" | "visit";

export type Scenario = {
  id: string;
  patientId: string;
  title: TextKey;
  blurb: TextKey;
  minutes: number;
  camera: boolean;
  steps: StepKind[];
  /** What the simulated session reports, so the rules produce the scenario's outcome. */
  simulation: {
    painBefore: number;
    painAfter: number;
    phantomPain: number | null;
    /** Reps per set for each plan item; null = set not done. */
    logged: (number | null)[][];
    difficulty: "easy" | "ok" | "hard";
    concern?: { kind: "wound"; details: string };
    /** Something the patient tells the coach, which the coach saves as a memory. */
    memory?: { kind: "goal"; said: Record<Lang, string>; text: Record<Lang, string> };
  };
  /** Scenario-specific instruction for a step, instead of the default one. */
  instructions?: Partial<Record<StepKind, TextKey>>;
  /** Who the dashboard shows (default physio). */
  careRole?: "physio" | "doctor";
  /** Turn the physio dashboard on automatically at this step. */
  dashboardAt?: StepKind;
  main?: boolean;
};

export const scenarios: Scenario[] = [
  {
    id: "pain-rising",
    patientId: "budi",
    title: "sc_pain_title",
    blurb: "sc_pain_blurb",
    minutes: 3,
    camera: true,
    main: true,
    steps: ["meet", "exercise", "summary", "next_day"],
    simulation: { painBefore: 4, painAfter: 8, phantomPain: 6, logged: [[10, 8], [7, null]], difficulty: "hard" },
  },
  {
    id: "try-yourself",
    patientId: "tester",
    title: "sc_try_title",
    blurb: "sc_try_blurb",
    minutes: 2,
    camera: true,
    steps: ["meet", "exercise", "summary"],
    simulation: { painBefore: 1, painAfter: 2, phantomPain: null, logged: [[5, 5], [5, 5]], difficulty: "ok" },
  },
  {
    id: "danger",
    patientId: "sari",
    title: "sc_danger_title",
    blurb: "sc_danger_blurb",
    minutes: 1,
    camera: false,
    steps: ["exercise", "summary"],
    dashboardAt: "summary",
    simulation: {
      painBefore: 2, painAfter: 2, phantomPain: null, logged: [[6, null], [null, null]], difficulty: "hard",
      concern: { kind: "wound", details: "my leg is bleeding where the socket rubs" },
    },
  },
  {
    id: "missed-days",
    patientId: "liem",
    title: "sc_liem_title",
    blurb: "sc_liem_blurb",
    minutes: 1,
    camera: false,
    steps: ["meet", "exercise", "summary"],
    simulation: { painBefore: 4, painAfter: 4, phantomPain: 5, logged: [[8, 6], [6, 5]], difficulty: "ok" },
  },
  {
    id: "before-visit",
    patientId: "budi",
    title: "sc_visit_title",
    blurb: "sc_visit_blurb",
    minutes: 1,
    camera: false,
    steps: ["skin", "visit"],
    dashboardAt: "visit",
    simulation: { painBefore: 4, painAfter: 6, phantomPain: 6, logged: [[10, 9], [8, 7]], difficulty: "hard" },
  },
];

scenarios.push(
  {
    id: "ready-for-more",
    patientId: "sari",
    title: "sc_progress_title",
    blurb: "sc_progress_blurb",
    minutes: 2,
    camera: true,
    steps: ["meet", "exercise", "summary", "next_day"],
    instructions: { summary: "ins_summary_progress" },
    simulation: { painBefore: 1, painAfter: 1, phantomPain: null, logged: [[12, 12], [8, 8]], difficulty: "easy" },
  },
  {
    id: "remembers",
    patientId: "tester",
    title: "sc_memory_title",
    blurb: "sc_memory_blurb",
    minutes: 2,
    camera: false,
    steps: ["meet", "exercise", "summary", "next_day"],
    instructions: { exercise: "ins_exercise_memory", next_day: "ins_next_day_memory" },
    simulation: {
      painBefore: 1, painAfter: 2, phantomPain: null, logged: [[5, 5], [5, 5]], difficulty: "ok",
      memory: {
        kind: "goal",
        said: {
          en: "I want to dance at my sister's wedding in December.",
          id: "Saya mau berdansa di pernikahan adik saya bulan Desember.",
          zh: "我想在十二月妹妹的婚礼上跳舞。",
        },
        text: {
          en: "Wants to dance at their sister's wedding in December.",
          id: "Ingin berdansa di pernikahan adiknya bulan Desember.",
          zh: "想在十二月妹妹的婚礼上跳舞。",
        },
      },
    },
  },
  {
    id: "check-up",
    patientId: "liem",
    title: "sc_checkup_title",
    blurb: "sc_checkup_blurb",
    minutes: 2,
    camera: false,
    careRole: "doctor",
    steps: ["checkup", "visit"],
    dashboardAt: "visit",
    instructions: { visit: "ins_visit_doctor" },
    simulation: { painBefore: 4, painAfter: 4, phantomPain: 5, logged: [[8, 8], [6, 6]], difficulty: "ok" },
  },
);

// Landing page order: the main story first, then try-it-yourself, then one feature per card.
const ORDER = ["pain-rising", "try-yourself", "ready-for-more", "remembers", "danger", "missed-days", "check-up", "before-visit"];
scenarios.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

export const scenarioById = (id: string) => scenarios.find((s) => s.id === id);
export const stepLabel = (k: StepKind): TextKey => `step_${k}`;
export const stepInstruction = (s: Scenario, k: StepKind): TextKey => s.instructions?.[k] ?? `ins_${k}`;
