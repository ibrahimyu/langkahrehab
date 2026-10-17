import assert from "node:assert/strict";
import { test } from "node:test";
import { planMinutes, repsSinceLastWeek, streakDays } from "../shared/home";

const at = (d: number, h = 9) => new Date(2026, 9, d, h).toISOString();
const NOW = new Date(2026, 9, 17, 12).getTime();

test("plan length in minutes, never zero", () => {
  assert.equal(planMinutes([]), 1);
  const m = planMinutes([{ exerciseId: "bridging", sets: 2, reps: 10 }]);
  assert.ok(m >= 1 && m <= 10, String(m));
});

test("days in a row count only true streaks", () => {
  assert.equal(streakDays([{ at: at(15) }, { at: at(16) }, { at: at(17) }], NOW), 3);
  assert.equal(streakDays([{ at: at(15) }, { at: at(16) }], NOW), 2); // today still open
  assert.equal(streakDays([{ at: at(14) }, { at: at(16, 8) }, { at: at(16, 18) }], NOW), 1);
  assert.equal(streakDays([], NOW), 0);
});

test("reps since last week compare against a session at least 7 days older", () => {
  const s = (d: number, reps: number[]) => ({ at: at(d), exercises: [{ exerciseId: "x", sets: reps.length, reps: 10, logged: reps }] });
  assert.equal(repsSinceLastWeek([s(8, [8, 8]), s(16, [10, 10])]), 4);
  assert.equal(repsSinceLastWeek([s(14, [8]), s(16, [10])]), null);
});
