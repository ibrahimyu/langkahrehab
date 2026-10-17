import assert from "node:assert/strict";
import { test } from "node:test";
import { loadsBody, mergeGoals, nextTarget } from "../shared/goals";
import type { Goal } from "../shared/model";

const ISO = "2026-10-17T08:00:00.000Z";
const base: Goal[] = [{
  id: "g1", text: "Walk to the mosque", area: "faith", main: true, createdAt: ISO, createdVia: "voice",
  targets: [
    { id: "t1", text: "Sit on the bed edge for 5 minutes", needsPhysioOk: false, physioOkAt: null, doneAt: null, targetMonth: null, source: "patient" },
    { id: "t2", text: "Walk 10 metres with the walker", needsPhysioOk: true, physioOkAt: null, doneAt: null, targetMonth: null, source: "physio" },
  ],
}];

test("standing and walking targets need the physio's OK, in three languages", () => {
  for (const t of ["Stand for 1 minute", "Jalan 10 meter dengan walker", "走到门口"]) assert.equal(loadsBody(t), true, t);
  for (const t of ["Sit on the bed edge", "Duduk di tepi kasur", "坐在床边"]) assert.equal(loadsBody(t), false, t);
});

test("a patient marks a safe target done, but not a body-loading one without the physio's OK", () => {
  const edit = structuredClone(base);
  edit[0]!.targets[0]!.doneAt = ISO;
  edit[0]!.targets[1]!.doneAt = ISO;
  edit[0]!.targets[1]!.physioOkAt = ISO; // the patient tries to grant the OK
  const out = mergeGoals(base, edit, "patient", ISO);
  assert.ok(out[0]!.targets[0]!.doneAt);
  assert.equal(out[0]!.targets[1]!.physioOkAt, null);
  assert.equal(out[0]!.targets[1]!.doneAt, null);
});

test("the physio grants the OK, then the patient can mark it done", () => {
  const approve = structuredClone(base);
  approve[0]!.targets[1]!.physioOkAt = ISO;
  const ok = mergeGoals(base, approve, "physio", ISO);
  assert.ok(ok[0]!.targets[1]!.physioOkAt);
  const done = structuredClone(ok);
  done[0]!.targets[1]!.doneAt = ISO;
  assert.ok(mergeGoals(ok, done, "patient", ISO)[0]!.targets[1]!.doneAt);
});

test("new goals get ids, empty text is dropped, and there is one main goal", () => {
  const out = mergeGoals(base, [...base, { text: "Play with my grandchildren", area: "family", main: true, targets: [{ text: "" }, { text: "Stand while they play" }] }, { text: "  " }], "patient", ISO);
  assert.equal(out.length, 2);
  assert.equal(out.filter((g) => g.main).length, 1);
  assert.equal(out[1]!.targets.length, 1);
  assert.equal(out[1]!.targets[0]!.needsPhysioOk, true);
  assert.equal(nextTarget(out)?.target.id, "t1");
});
