// Session settings. Defaults are the combination that worked best in the sandbox
// (camera counting, app-controlled turn-taking); the session page lets testers change them.

import type { CountMode } from "./model";

export type TurnKind = "auto" | "app";

export type Settings = {
  mode: CountMode;
  turn: {
    /** app: the browser decides when the patient has finished speaking; auto: Gemini decides. */
    kind: TurnKind;
    /** Silence that ends a turn outside sets (and always, in auto mode). */
    silenceMs: number;
    /** App mode only: silence that ends a turn while a set is in progress. */
    inSetSilenceMs: number;
    /** App mode only: microphone level (RMS, 0–1) that counts as speech. */
    threshold: number;
    endSensitivity: "default" | "low" | "high";
  };
  bargeIn: boolean;
  askDiary: boolean;
  voice: string;
  poseModel: "lite" | "full";
  /** On my own (everything spoken) or with a helper (tips on screen for them too). */
  support: "alone" | "helper";
};

export const VOICES = ["Aoede", "Kore", "Leda", "Zephyr", "Puck", "Charon", "Orus", "Fenrir"];

export const defaultSettings: Settings = {
  mode: "camera",
  turn: { kind: "app", silenceMs: 700, inSetSilenceMs: 3000, threshold: 0.02, endSensitivity: "default" },
  bargeIn: true,
  askDiary: true,
  voice: "Aoede",
  poseModel: "full",
  support: "alone",
};

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/** Validates settings from the browser; unknown or out-of-range values fall back to defaults. */
export function parseSettings(input: unknown): Settings {
  const s = (input ?? {}) as Record<string, any>;
  const t = (s.turn ?? {}) as Record<string, unknown>;
  const d = defaultSettings;
  const threshold = Number(t.threshold);
  return {
    mode: pick(s.mode, ["camera", "patient", "coach"] as const, d.mode),
    turn: {
      kind: pick(t.kind, ["auto", "app"] as const, d.turn.kind),
      silenceMs: int(t.silenceMs, 200, 5000, d.turn.silenceMs),
      inSetSilenceMs: int(t.inSetSilenceMs, 500, 10000, d.turn.inSetSilenceMs),
      threshold: Number.isFinite(threshold) ? Math.min(0.3, Math.max(0.002, threshold)) : d.turn.threshold,
      endSensitivity: pick(t.endSensitivity, ["default", "low", "high"] as const, d.turn.endSensitivity),
    },
    bargeIn: typeof s.bargeIn === "boolean" ? s.bargeIn : d.bargeIn,
    askDiary: typeof s.askDiary === "boolean" ? s.askDiary : d.askDiary,
    voice: pick(s.voice, VOICES, d.voice),
    poseModel: pick(s.poseModel, ["lite", "full"] as const, d.poseModel),
    support: pick(s.support, ["alone", "helper"] as const, d.support),
  };
}
