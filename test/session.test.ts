import { test } from "node:test";
import assert from "node:assert/strict";
import { exerciseById } from "../shared/exercises";
import { applyTool, createSession, endRest, painIn, toRecordExercises } from "../shared/session";

const make = () =>
  createSession("camera", [
    { exercise: exerciseById("bridging")!, sets: 2, reps: 10 },
    { exercise: exerciseById("sit-to-stand")!, sets: 1, reps: 8 },
  ]);

test("runs through every exercise in the plan", () => {
  const s = make();
  assert.equal(applyTool(s, "start_set", { set: 1 }, 0).ok, false, "pain first");
  assert.equal(applyTool(s, "record_pain", { when: "before", score: 3 }, 0).ok, true);
  assert.equal(applyTool(s, "start_set", { set: 1 }, 1).ok, true);
  assert.equal(applyTool(s, "log_set", { set: 1, reps: 10 }, 2).ok, true);
  assert.equal(s.phase, "rest");
  assert.match(endRest(s)!, /Start set 2 of 2 of Bridging/);
  applyTool(s, "start_set", { set: 2 }, 3);
  applyTool(s, "log_set", { set: 2, reps: 9 }, 4);
  assert.equal(s.item, 1, "moved to the next exercise");
  assert.equal(s.current, 1);
  assert.match(endRest(s)!, /Next exercise: Sit to stand/);
  applyTool(s, "start_set", { set: 1 }, 5);
  applyTool(s, "log_set", { set: 1, reps: 8 }, 6);
  assert.equal(s.phase, "after");
  applyTool(s, "record_pain", { when: "after", score: 4 }, 7);
  assert.equal(applyTool(s, "finish_session", { difficulty: "ok" }, 8).ok, true);
  assert.deepEqual(toRecordExercises(s).map((e) => e.logged), [[10, 9], [8]]);
});

test("invalid calls are rejected and a concern stops everything", () => {
  const s = make();
  assert.equal(applyTool(s, "record_pain", { when: "before", score: 11 }, 0).ok, false);
  applyTool(s, "record_pain", { when: "before", score: 2 }, 0);
  assert.equal(applyTool(s, "start_set", { set: 2 }, 0).ok, false);
  assert.equal(applyTool(s, "log_set", { set: 1, reps: 10 }, 0).ok, false);
  applyTool(s, "start_set", { set: 1 }, 0);
  assert.equal(applyTool(s, "report_concern", { kind: "wound", details: "bleeding" }, 1).ok, true);
  assert.equal(s.phase, "stopped");
  assert.equal(applyTool(s, "log_set", { set: 1, reps: 3 }, 2).ok, false);
});

test("pain given between sets or with a concern reaches the summary", () => {
  const s = make();
  applyTool(s, "record_pain", { when: "before", score: 4 }, 0);
  assert.equal(applyTool(s, "record_pain", { when: "during", score: 6 }, 1).ok, true);
  assert.equal(s.painAfter, 6);
  applyTool(s, "report_concern", { kind: "severe_pain", details: "it is 8 now, very sharp" }, 2);
  assert.equal(s.painAfter, 8);
  assert.equal(painIn("no number"), null);
});
