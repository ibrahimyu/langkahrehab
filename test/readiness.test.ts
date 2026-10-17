import assert from "node:assert/strict";
import { test } from "node:test";
import { seedCases } from "../shared/cases";
import { DAY, emptyReadiness, withDefaults, type Patient, type SkinCheck } from "../shared/model";
import { allMet, canSet, mergeReadiness, metCount, readinessSignals } from "../shared/readiness";
import { computeJourneyStage } from "../shared/journey";

const NOW = Date.parse("2026-10-17T10:00:00Z");
const budi = (): Patient => withDefaults(structuredClone(seedCases(NOW).find((p) => p.id === "budi")!));
const skin = (daysAgo: number, urgency: SkinCheck["result"]["urgency"]): SkinCheck => ({
  id: `s${daysAgo}`, at: new Date(NOW - daysAgo * DAY).toISOString(), lang: "en", area: "residual_limb",
  result: { usable: true, retakeTip: "", findings: [], urgency, patientMessage: "", careTeamNote: "" },
});

test("wound: a worrying check in the last 7 days is not_yet; calm checks are progressing; none is not_assessed", () => {
  const p = budi();
  p.skinChecks = [];
  assert.equal(readinessSignals(p, NOW).wound.status, "not_assessed");
  p.skinChecks = [skin(10, "none")];
  assert.equal(readinessSignals(p, NOW).wound.status, "progressing");
  p.skinChecks.push(skin(3, "contact_soon"));
  assert.equal(readinessSignals(p, NOW).wound.status, "not_yet");
  p.skinChecks = [skin(9, "urgent"), skin(2, "monitor")];
  assert.equal(readinessSignals(p, NOW).wound.status, "progressing");
});

test("signals never say met, and unmeasured criteria stay not_assessed", () => {
  const s = readinessSignals(budi(), NOW);
  for (const v of Object.values(s)) assert.notEqual(v.status, "met");
  assert.equal(s.volume.status, "not_assessed");
  assert.equal(s.range.status, "not_assessed");
  assert.equal(s.skin.status, "not_assessed");
});

test("strength and engagement follow adherence; home follows the family's safety tasks", () => {
  const p = budi();
  p.sessions = [];
  assert.equal(readinessSignals(p, NOW).strength.status, "not_assessed");
  p.plan.items = [{ exerciseId: "bridging", sets: 1, reps: 10 }];
  p.sessions = Array.from({ length: 14 }, (_, i) => ({
    id: `x${i}`, at: new Date(NOW - (13 - i) * DAY).toISOString(), planVersion: 1, lang: "en" as const, mode: "camera" as const,
    exercises: [{ exerciseId: "bridging", sets: 1, reps: 10, logged: [10] }],
    painBefore: 2, painAfter: 2, difficulty: "ok" as const, concern: null, nextAction: { kind: "keep_going" as const }, source: "session" as const,
  }));
  assert.equal(readinessSignals(p, NOW).strength.status, "progressing");
  p.goals = [];
  assert.equal(readinessSignals(p, NOW).engagement.status, "not_yet");
  p.goals = [{ id: "g", text: "Walk to the mosque", area: "faith", main: true, createdAt: "", createdVia: "text", targets: [] }];
  assert.equal(readinessSignals(p, NOW).engagement.status, "progressing");
  const home = p.familyTasks.filter((t) => t.category === "home_safety");
  if (home.length) {
    home.forEach((t) => (t.status = "done"));
    assert.equal(readinessSignals(p, NOW).falls_home.status, "progressing");
  }
});

test("automatic signals never overwrite or lower a clinician's mark", () => {
  const p = budi();
  p.skinChecks = [skin(1, "urgent")];
  const stored = emptyReadiness();
  stored.wound = { status: "met", source: "doctor", setAt: "2026-10-10", evidence: [], note: "Healed at visit" };
  const merged = mergeReadiness(stored, readinessSignals(p, NOW), NOW);
  assert.equal(merged.wound.status, "met");
  assert.equal(merged.wound.source, "doctor");
  assert.equal(mergeReadiness(emptyReadiness(), readinessSignals(p, NOW), NOW).wound.status, "not_yet");
});

test("who may set what, counting, and the journey step", () => {
  assert.equal(canSet("physio", "strength"), true);
  assert.equal(canSet("physio", "wound"), false);
  assert.equal(canSet("doctor", "skin"), true);
  const r = emptyReadiness();
  assert.equal(metCount(r), 0);
  for (const k of Object.keys(r) as (keyof typeof r)[]) r[k] = { ...r[k], status: "met", source: "doctor" };
  assert.equal(allMet(r), true);
  const p = budi();
  assert.equal(computeJourneyStage({ ...p, readiness: emptyReadiness() }), 2);
  assert.equal(computeJourneyStage({ ...p, clearedForFittingAt: "2026-10-17" }), 3);
});
