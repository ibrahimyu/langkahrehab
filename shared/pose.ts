// Rep counting from MediaPipe pose landmarks: one movement signal per exercise (an angle in
// degrees), counted with two thresholds so jitter around one value cannot double-count.

import type { RepScore } from "./form";

export type Landmark = { x: number; y: number; z?: number; visibility?: number };
export type Side = "left" | "right";
/** "none" is for testers without an amputation: `side` is then the leg that does the exercise. */
export type Level = "none" | "below_knee" | "above_knee";
export type Limb = { level: Level; side: Side };

const IDX = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28 },
} as const;
type Joint = keyof (typeof IDX)["left"];

export type Tracking = {
  label: string;
  /** Signal at or above this = top of the movement. */
  up: number;
  /** Signal at or below this = back at the start. */
  down: number;
  /** Plausible range of the signal, for the chart. */
  range: [number, number];
  /** Where to put the camera. */
  camera: string;
  /** Why this exercise cannot be tracked for this limb, if it cannot. */
  unsupported?: string;
  /** Landmarks used, as [side, joint]. */
  uses: [Side, Joint][];
  compute: (lm: Landmark[]) => number;
};

export const MIN_VISIBILITY = 0.5;

const other = (s: Side): Side => (s === "left" ? "right" : "left");
const pt = (lm: Landmark[], side: Side, j: Joint) => lm[IDX[side][j]]!;
const mid = (a: Landmark, b: Landmark): Landmark => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Angle ABC in degrees (0–180), in the image plane. */
export function angle(a: Landmark, b: Landmark, c: Landmark) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/** How far the line from `from` to `to` points upwards in the image, in degrees (−90 to 90). */
export function elevation(from: Landmark, to: Landmark) {
  return (Math.atan2(from.y - to.y, Math.abs(to.x - from.x) || 1e-6) * 180) / Math.PI;
}

const NO_KNEE = "Above-knee amputation: there is no knee point on that side, so this movement cannot be measured in this test.";

export function tracking(exerciseId: string, limb: Limb): Tracking | null {
  const amp = limb.side;
  const good = other(amp);
  switch (exerciseId) {
    case "bridging":
      // Hips rise: the shoulder–hip–knee angle of the intact leg opens towards straight.
      return {
        label: "Hip angle (shoulder–hip–knee, intact side)",
        up: 160,
        down: 145,
        range: [100, 185],
        camera: "Side view at floor level, about 2 m away, whole body in frame.",
        uses: [[good, "shoulder"], [good, "hip"], [good, "knee"]],
        compute: (lm) => angle(pt(lm, good, "shoulder"), pt(lm, good, "hip"), pt(lm, good, "knee")),
      };
    case "side-lying-abduction":
      // Top leg lifts: the angle between the two thighs at the middle of the hips grows.
      return {
        label: "Angle between the thighs",
        up: 25,
        down: 12,
        range: [0, 60],
        camera: "From the feet or the front, about 2 m away, both hips and knees in frame.",
        unsupported: limb.level === "above_knee" ? NO_KNEE : undefined,
        uses: [[good, "hip"], [amp, "hip"], [good, "knee"], [amp, "knee"]],
        compute: (lm) =>
          angle(pt(lm, good, "knee"), mid(pt(lm, good, "hip"), pt(lm, amp, "hip")), pt(lm, amp, "knee")),
      };
    case "prone-hip-extension":
      // Lying on the stomach: the thigh of the exercising leg tilts upwards from the hip.
      return {
        label: "Thigh lift (degrees above the floor)",
        up: 12,
        down: 5,
        range: [-10, 35],
        camera: "Side view at floor level, on the side of the exercising leg, about 2 m away.",
        unsupported: limb.level === "above_knee" ? NO_KNEE : undefined,
        uses: [[amp, "hip"], [amp, "knee"]],
        compute: (lm) => elevation(pt(lm, amp, "hip"), pt(lm, amp, "knee")),
      };
    case "sit-to-stand":
      // Standing up straightens the intact knee (hip–knee–ankle).
      return {
        label: "Knee angle (hip–knee–ankle, intact side)",
        up: 155,
        down: 115,
        range: [70, 185],
        camera: "Side view at hip height, about 2.5 m away, chair and whole body in frame.",
        uses: [[good, "hip"], [good, "knee"], [good, "ankle"]],
        compute: (lm) => angle(pt(lm, good, "hip"), pt(lm, good, "knee"), pt(lm, good, "ankle")),
      };
  }
  return null;
}

/** Landmarks the tracking needs that the camera cannot see well enough. */
export function missing(t: Tracking, lm: Landmark[]) {
  return t.uses
    .filter(([side, joint]) => (lm[IDX[side][joint]]?.visibility ?? 0) < MIN_VISIBILITY)
    .map(([side, joint]) => `${side} ${joint}`);
}

export type Cue = "hold_longer" | "slow_down" | "go_further";
export type RepEvent = { count: number; heldMs: number; durationMs: number; peak: number; cue: Cue | null; form?: RepScore };

/** Counts a rep when the signal goes above `up` and comes back below `down`. */
export class RepCounter {
  count = 0;
  atTop = false;
  private topSince = 0;
  private startedAt = 0;
  private peak = -Infinity;

  constructor(
    public up: number,
    public down: number,
    /** Target hold at the top; 0 for movements without a hold. */
    public holdMs: number,
  ) {}

  push(value: number, now: number): RepEvent | null {
    if (!this.atTop) {
      if (!this.startedAt && value > this.down) this.startedAt = now;
      if (value >= this.up) {
        this.atTop = true;
        this.topSince = now;
        this.peak = value;
        if (!this.startedAt) this.startedAt = now;
      }
      return null;
    }
    this.peak = Math.max(this.peak, value);
    if (value > this.down) return null;

    this.atTop = false;
    this.count++;
    const heldMs = now - this.topSince;
    const durationMs = now - this.startedAt;
    this.startedAt = 0;
    const cue: Cue | null =
      this.holdMs > 0 && heldMs < this.holdMs * 0.6 ? "hold_longer" : this.holdMs === 0 && durationMs < 1200 ? "slow_down" : null;
    const peak = Math.round(this.peak);
    this.peak = -Infinity;
    return { count: this.count, heldMs, durationMs, peak, cue };
  }

  reset() {
    this.count = 0;
    this.atTop = false;
    this.startedAt = 0;
    this.peak = -Infinity;
  }
}
