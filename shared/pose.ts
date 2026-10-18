// Rep counting from MediaPipe pose landmarks: one movement signal per exercise (an angle in
// degrees), counted with two thresholds so jitter around one value cannot double-count.

import type { RepScore } from "./form";

export type Landmark = { x: number; y: number; z?: number; visibility?: number };
export type Side = "left" | "right";
/** "none" is for testers without an amputation: `side` is then the leg that does the exercise. */
export type Level = "none" | "below_knee" | "above_knee";
/** `arm`: the amputated arm, when there is one; arm exercises are measured on that side. */
export type Limb = { level: Level; side: Side; arm?: { side: Side; elbowLost: boolean } };

const IDX = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
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
  /** Count from the lowest value of the last seconds (the resting level), not from zero. */
  baseline?: boolean;
  /** Landmarks used, as [side, joint]. */
  uses: [Side, Joint][];
  compute: (lm: Landmark[]) => number;
};

export const MIN_VISIBILITY = 0.5;

const other = (s: Side): Side => (s === "left" ? "right" : "left");
const pt = (lm: Landmark[], side: Side, j: Joint) => lm[IDX[side][j]]!;

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
const NO_ELBOW = "Amputation at or above the elbow: there is no elbow point on that side, so this movement cannot be measured.";

export function tracking(exerciseId: string, limb: Limb): Tracking | null {
  const amp = limb.side;
  const good = other(amp);
  switch (exerciseId) {
    case "bridging":
      // The hips rise off the mat while the shoulders stay down, so the shoulder-to-hip line tilts
      // upwards. This reads the same whichever knee is bent or rests on the towel, and does not
      // depend on MediaPipe telling left from right, which it often swaps in a side view.
      return {
        // Lying flat reads anywhere from about −5° to 10° depending on how the phone is tilted, so
        // the lift is counted from the resting level (baseline).
        label: "Hip lift (degrees above resting)",
        up: 10,
        down: 4,
        range: [0, 40],
        baseline: true,
        camera: "Side view at floor level, about 2 m away, whole body in frame.",
        uses: [[amp, "shoulder"], [amp, "hip"]],
        compute: (lm) => elevation(pt(lm, amp, "shoulder"), pt(lm, amp, "hip")),
      };
    case "side-lying-abduction":
      // The top (amputated) leg lifts away from the line of the body: 180° minus the
      // shoulder–hip–knee angle on that side. The other leg moving does not count.
      return {
        label: "Leg lift (degrees from the line of the body)",
        up: 18,
        down: 8,
        range: [0, 60],
        camera: "From the feet or the front, about 2 m away, both hips and knees in frame.",
        unsupported: limb.level === "above_knee" ? NO_KNEE : undefined,
        uses: [[amp, "shoulder"], [amp, "hip"], [amp, "knee"]],
        compute: (lm) => 180 - angle(pt(lm, amp, "shoulder"), pt(lm, amp, "hip"), pt(lm, amp, "knee")),
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
    case "arm-raise-forward": {
      // The arm lifts forward: the hip–shoulder–elbow angle opens.
      const arm = limb.arm?.side ?? limb.side;
      return {
        label: "Shoulder angle (hip–shoulder–elbow)",
        up: 70,
        down: 35,
        range: [0, 180],
        camera: "Side view at chest height, about 2 m away, the exercising arm towards the camera.",
        unsupported: limb.arm?.elbowLost ? NO_ELBOW : undefined,
        uses: [[arm, "hip"], [arm, "shoulder"], [arm, "elbow"]],
        compute: (lm) => angle(pt(lm, arm, "hip"), pt(lm, arm, "shoulder"), pt(lm, arm, "elbow")),
      };
    }
    case "elbow-bend": {
      // The elbow bends: 180° minus the shoulder–elbow–wrist angle grows.
      const arm = limb.arm?.side ?? limb.side;
      return {
        label: "Elbow bend (degrees from straight)",
        up: 60,
        down: 25,
        range: [0, 160],
        camera: "Front or side view at chest height, about 1.5 m away, the whole arm in frame.",
        unsupported: limb.arm?.elbowLost ? NO_ELBOW : undefined,
        uses: [[arm, "shoulder"], [arm, "elbow"], [arm, "wrist"]],
        compute: (lm) => 180 - angle(pt(lm, arm, "shoulder"), pt(lm, arm, "elbow"), pt(lm, arm, "wrist")),
      };
    }
  }
  return null;
}

/** The limb the camera watches for this exercise, for the label on screen ("your left leg"). */
export function watched(t: Tracking): { side: Side; part: "leg" | "arm" } {
  const [side, joint] = t.uses[t.uses.length - 1]!;
  return { side, part: joint === "elbow" || joint === "wrist" ? "arm" : "leg" };
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
