import assert from "node:assert/strict";
import { test } from "node:test";
import { tracking, type Landmark } from "../shared/pose.ts";

const body = (elbow: Landmark, wrist: Landmark) => {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  lm[12] = { x: 0.5, y: 0.3, visibility: 1 }; // right shoulder
  lm[24] = { x: 0.5, y: 0.7, visibility: 1 }; // right hip
  lm[14] = elbow;
  lm[16] = wrist;
  return lm;
};

test("arm exercises are measured on the amputated arm", () => {
  const limb = { level: "none" as const, side: "left" as const, arm: { side: "right" as const, elbowLost: false } };
  const raise = tracking("arm-raise-forward", limb)!;
  assert.ok(raise.uses.every(([side]) => side === "right"));
  // Arm straight forward: 90° between the trunk and the upper arm.
  assert.equal(Math.round(raise.compute(body({ x: 0.7, y: 0.3, visibility: 1 }, { x: 0.9, y: 0.3, visibility: 1 }))), 90);
  const bend = tracking("elbow-bend", limb)!;
  // Forearm at a right angle to the upper arm: bent 90° from straight.
  assert.equal(Math.round(bend.compute(body({ x: 0.5, y: 0.5, visibility: 1 }, { x: 0.7, y: 0.5, visibility: 1 }))), 90);
});

test("without an elbow, arm movements are not measured", () => {
  const limb = { level: "none" as const, side: "left" as const, arm: { side: "right" as const, elbowLost: true } };
  assert.ok(tracking("arm-raise-forward", limb)?.unsupported);
  assert.ok(tracking("elbow-bend", limb)?.unsupported);
});
