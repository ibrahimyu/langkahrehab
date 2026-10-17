import assert from "node:assert/strict";
import { test } from "node:test";
import { looksAfter } from "../shared/accounts.ts";
import { firstPlan, newPatient, sanitizeNewPatient } from "../shared/patients.ts";

test("a new patient gets a plan for their limbs, accounts and a care team", () => {
  const input = sanitizeNewPatient({
    name: "Ibu Ani", age: 52, lang: "id", cause: "injury",
    limbs: [{ site: "upper", side: "right", level: "below_elbow" }],
    physioId: "rina", doctorId: "hendra",
    family: [{ name: "Andi", relation: "child", livesWithPatient: true }, { name: "" }],
  });
  assert.ok(typeof input !== "string");
  const { patient, accounts } = newPatient(input, Date.now());
  assert.ok(patient.plan.items.length > 0 && patient.plan.awaitingPhysio);
  assert.ok(patient.plan.items.every((i) => !["bridging", "sit-to-stand"].includes(i.exerciseId)), "no leg exercises for an arm");
  assert.deepEqual(accounts.map((a) => a.role), ["patient", "family"]);
  assert.ok(accounts.every((a) => a.patientId === patient.id && a.active));
  assert.deepEqual(patient.careTeam, { physioId: "rina", doctorId: "hendra" });
});

test("bad input is refused with a reason", () => {
  assert.equal(typeof sanitizeNewPatient({ name: "", age: 40, limbs: [] }), "string");
  assert.equal(typeof sanitizeNewPatient({ name: "A", age: 40, limbs: [] }), "string");
  assert.ok(firstPlan([{ site: "lower", side: "left", level: "above_knee" }]).length > 0);
});

test("clinicians see the patients they look after", () => {
  const p = { careTeam: { physioId: "rina", doctorId: null } };
  assert.equal(looksAfter("rina", "physio", p), true);
  assert.equal(looksAfter("other", "physio", p), false);
  assert.equal(looksAfter("any", "doctor", p), true);
  assert.equal(looksAfter("x", "physio", {}), true);
});
