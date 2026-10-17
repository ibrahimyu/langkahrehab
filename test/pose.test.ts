import { test } from "node:test";
import assert from "node:assert/strict";
import { RepCounter, angle, elevation, missing, tracking, type Landmark } from "../shared/pose";

test("angle and elevation", () => {
  assert.equal(Math.round(angle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })), 180);
  assert.equal(Math.round(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })), 90);
  // Image y grows downwards, so a point higher up has a smaller y.
  assert.equal(Math.round(elevation({ x: 0, y: 1 }, { x: 1, y: 0 })), 45);
  assert.equal(Math.round(elevation({ x: 1, y: 0 }, { x: 0, y: 0 })), 0);
});

test("counts reps with hysteresis and ignores jitter", () => {
  const c = new RepCounter(160, 145, 0);
  const seq = [130, 150, 158, 161, 159, 162, 150, 146, 144, 140, 161, 163, 150, 140];
  const events = seq.map((v, i) => c.push(v, i * 500)).filter(Boolean);
  assert.equal(c.count, 2);
  assert.deepEqual(events.map((e) => e!.count), [1, 2]);
  assert.equal(events[0]!.peak, 162);
});

test("cues: short hold and too fast", () => {
  const hold = new RepCounter(160, 145, 3000);
  hold.push(170, 0);
  assert.equal(hold.push(140, 1000)!.cue, "hold_longer");
  hold.push(170, 2000);
  assert.equal(hold.push(140, 5000)!.cue, null);

  const fast = new RepCounter(155, 115, 0);
  fast.push(120, 0);
  fast.push(160, 300);
  assert.equal(fast.push(110, 800)!.cue, "slow_down");
});

test("tracking watches the amputated leg, the intact one only where no knee exists", () => {
  const bridging = tracking("bridging", { level: "above_knee", side: "left" })!;
  assert.equal(bridging.unsupported, undefined);
  assert.ok(bridging.uses.every(([side]) => side === "right"));
  assert.ok(tracking("bridging", { level: "below_knee", side: "left" })!.uses.every(([side]) => side === "left"));
  assert.ok(tracking("side-lying-abduction", { level: "below_knee", side: "left" })!.uses.every(([side]) => side === "left"));
  assert.match(tracking("prone-hip-extension", { level: "above_knee", side: "right" })!.unsupported!, /no knee/);
  assert.equal(tracking("prone-hip-extension", { level: "below_knee", side: "right" })!.unsupported, undefined);
  assert.equal(tracking("unknown", { level: "none", side: "left" }), null);
});

test("bridging signal from synthetic landmarks", () => {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.9 }));
  // Left side (the amputated, below-knee leg): shoulder, hip, knee in a straight line.
  lm[11] = { x: 0.2, y: 0.6, visibility: 0.9 };
  lm[23] = { x: 0.5, y: 0.6, visibility: 0.9 };
  lm[25] = { x: 0.8, y: 0.6, visibility: 0.9 };
  const t = tracking("bridging", { level: "below_knee", side: "left" })!;
  assert.equal(Math.round(t.compute(lm)), 180);
  assert.deepEqual(missing(t, lm), []);
  lm[25] = { ...lm[25]!, visibility: 0.2 };
  assert.deepEqual(missing(t, lm), ["left knee"]);
});

test("side-lying lift counts only the amputated leg", () => {
  const t = tracking("side-lying-abduction", { level: "below_knee", side: "left" })!;
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  lm[11] = { x: 0.5, y: 0.2, visibility: 0.9 };
  lm[23] = { x: 0.5, y: 0.5, visibility: 0.9 };
  lm[25] = { x: 0.5, y: 0.8, visibility: 0.9 }; // in line with the body
  lm[26] = { x: 0.9, y: 0.7, visibility: 0.9 }; // the other leg far out: ignored
  assert.equal(Math.round(t.compute(lm)), 0);
  lm[25] = { x: 0.6, y: 0.8, visibility: 0.9 }; // the amputated leg lifts
  assert.ok(t.compute(lm) > 15);
});
