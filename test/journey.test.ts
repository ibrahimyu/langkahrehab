import assert from "node:assert/strict";
import { test } from "node:test";
import { computeJourneyStage, repsProgress, type JourneyInput } from "../shared/journey";

const base = (over: Partial<JourneyInput["profile"]> = {}, extra: Partial<JourneyInput> = {}): JourneyInput => ({
  profile: { level: "below_knee", side: "left", stage: "pre_prosthetic", cause: "diabetes", restrictions: "", ...over },
  ...extra,
});

test("computeJourneyStage follows the five steps", () => {
  assert.equal(computeJourneyStage(base({}, { readiness: { wound: { status: "not_yet" } } })), 1);
  assert.equal(computeJourneyStage(base({}, { readiness: { wound: { status: "progressing" } } })), 2);
  assert.equal(computeJourneyStage(base()), 2);
  assert.equal(computeJourneyStage(base({}, { clearedForFittingAt: "2026-10-01" })), 3);
  assert.equal(computeJourneyStage(base({ stage: "prosthetic" })), 4);
  assert.equal(computeJourneyStage(base({ stage: "prosthetic" }, { goalReachedAt: "2026-10-01" })), 5);
});

test("a tester without an amputation is always on step 2", () => {
  assert.equal(computeJourneyStage(base({ level: "none" }, { goalReachedAt: "2026-10-01", readiness: { wound: { status: "not_yet" } } })), 2);
});

test("repsProgress only shows real progress over at least two weeks", () => {
  const s = (at: string, reps: number[]) => ({ at, exercises: [{ logged: reps }] }) as never;
  const now = Date.parse("2026-10-17T10:00:00Z");
  assert.deepEqual(repsProgress([s("2026-09-26T10:00:00Z", [6]), s("2026-10-17T09:00:00Z", [10])], now), { weeks: 3, before: 6, today: 10 });
  assert.equal(repsProgress([s("2026-10-10T10:00:00Z", [6]), s("2026-10-17T09:00:00Z", [10])], now), null);
  assert.equal(repsProgress([s("2026-09-26T10:00:00Z", [10]), s("2026-10-17T09:00:00Z", [8])], now), null);
});
