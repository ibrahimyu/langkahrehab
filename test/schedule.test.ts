import assert from "node:assert/strict";
import { test } from "node:test";
import { planDiff, schedule } from "../shared/planDiff.ts";

test("a plan without a schedule is once a day, every day; a change shows in the diff", () => {
  const base = { items: [], note: "", painThreshold: 7, reviewDate: "2026-10-20" };
  assert.deepEqual(schedule(base), { perDay: 1, daysPerWeek: 7 });
  assert.deepEqual(planDiff(base, { ...base, perDay: 2, daysPerWeek: 5 }), [
    { kind: "schedule", field: "perDay", from: 1, to: 2 },
    { kind: "schedule", field: "daysPerWeek", from: 7, to: 5 },
  ]);
});
