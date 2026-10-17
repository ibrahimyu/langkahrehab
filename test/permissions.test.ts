import assert from "node:assert/strict";
import { test } from "node:test";
import { can } from "../shared/permissions";

test("physio owns exercises, doctor owns clinical limits and the profile", () => {
  assert.equal(can("physio", "plan.exercises"), true);
  assert.equal(can("physio", "plan.limits"), false);
  assert.equal(can("doctor", "plan.limits"), true);
  assert.equal(can("doctor", "plan.exercises"), false);
  assert.equal(can("doctor", "profile.edit"), true);
  assert.equal(can("physio", "profile.edit"), false);
});

test("family and patient cannot change the plan; only the patient saves sessions", () => {
  for (const r of ["family", "patient"] as const) {
    assert.equal(can(r, "plan.exercises"), false);
    assert.equal(can(r, "plan.limits"), false);
  }
  assert.equal(can("patient", "session.save"), true);
  assert.equal(can("physio", "session.save"), false);
  assert.equal(can("family", "skin.check"), true);
});

test("a physio handles physio alerts; the doctor handles any alert", () => {
  const doctorOnly = { alert: { for: ["doctor" as const] } };
  const shared = { alert: { for: ["doctor" as const, "physio" as const] } };
  assert.equal(can("physio", "alert.resolve", doctorOnly), false);
  assert.equal(can("physio", "alert.resolve", shared), true);
  assert.equal(can("doctor", "alert.resolve", doctorOnly), true);
  assert.equal(can("family", "alert.resolve", shared), false);
});

test("only the patient talks with Langkah", () => {
  assert.equal(can("patient", "talk.use"), true);
  for (const r of ["family", "physio", "doctor"] as const) assert.equal(can(r, "talk.use"), false);
  assert.equal(can("family", "familyTalk.use"), true);
  for (const r of ["patient", "physio", "doctor"] as const) assert.equal(can(r, "familyTalk.use"), false);
});

test("family: tasks, questions and letters are theirs; clinical data stays with the care team", () => {
  assert.equal(can("family", "familyTask.do"), true);
  assert.equal(can("patient", "familyTask.do"), false);
  assert.equal(can("family", "familyTask.edit"), true);
  assert.equal(can("doctor", "familyTask.edit"), false);
  assert.equal(can("family", "familyQuestion.add"), true);
  assert.equal(can("family", "letter.send"), true);
  assert.equal(can("family", "familyUpdate.edit"), false);
  assert.equal(can("physio", "familyUpdate.edit"), true);
  for (const r of ["patient", "family", "physio"] as const) assert.equal(can(r, "family.edit"), true);
  assert.equal(can("family", "brief.generate"), false);
  assert.equal(can("family", "note.review"), false);
});

test("doctor: letter intake and fitting clearance; both clinicians mark readiness", () => {
  assert.equal(can("doctor", "intake.review"), true);
  for (const r of ["patient", "family", "physio"] as const) assert.equal(can(r, "intake.review"), false);
  assert.equal(can("physio", "readiness.edit"), true);
  assert.equal(can("doctor", "readiness.edit"), true);
  assert.equal(can("patient", "readiness.edit"), false);
  assert.equal(can("family", "readiness.edit"), false);
  assert.equal(can("doctor", "readiness.clear"), true);
  assert.equal(can("physio", "readiness.clear"), false);
});

test("only the physio decides progression proposals", () => {
  assert.equal(can("physio", "proposal.decide"), true);
  for (const r of ["doctor", "patient", "family"] as const) assert.equal(can(r, "proposal.decide"), false);
  assert.equal(can("doctor", "triage.view"), true);
  assert.equal(can("family", "triage.view"), false);
});
