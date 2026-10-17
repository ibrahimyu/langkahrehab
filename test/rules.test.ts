import { test } from "node:test";
import assert from "node:assert/strict";
import { seedCases } from "../shared/cases";
import { DAY, newId, type SessionRecord } from "../shared/model";
import { addAlerts, afterSession, daily, weekAdherence } from "../shared/rules";
import { buildInstruction, coachContext } from "../shared/coach";

const NOW = Date.parse("2026-10-16T08:00:00Z");
const cases = () => seedCases(NOW);
const record = (before: number | null, after: number | null, concern: SessionRecord["concern"] = null): SessionRecord => ({
  id: newId(), at: new Date(NOW).toISOString(), planVersion: 1, lang: "id", mode: "camera",
  exercises: [{ exerciseId: "bridging", sets: 2, reps: 10, logged: [10, 10] }],
  painBefore: before, painAfter: after, difficulty: "ok", concern, nextAction: { kind: "keep_going" }, source: "session",
});

test("seed cases are complete", () => {
  const c = cases();
  assert.deepEqual(c.map((p) => p.id), ["budi", "sari", "liem", "rafi", "tester"]);
  for (const p of c) assert.ok(p.plan.items.length >= 1);
});

test("a concern stops and alerts doctor and physio", () => {
  const sari = cases()[1]!;
  const r = afterSession(sari, record(1, 2, { kind: "wound", details: "bleeding" }), NOW);
  assert.equal(r.nextAction.kind, "stop_contact");
  assert.equal(r.alerts[0]!.severity, "urgent");
  assert.deepEqual(r.alerts[0]!.for, ["doctor", "physio"]);
});

test("distress is an urgent wellbeing alert, never merged with an open one", () => {
  const sari = cases()[1]!;
  const r = afterSession(sari, record(1, 2, { kind: "distress", details: "no point living", source: "keyword_fallback" }), NOW);
  assert.equal(r.alerts[0]!.kind, "wellbeing");
  assert.equal(r.alerts[0]!.severity, "urgent");
  assert.match(r.alerts[0]!.message, /safety check/);
  assert.equal(r.nextAction.kind, "stop_contact");
});

test("high pain and a jump of 3 both alert", () => {
  const sari = cases()[1]!;
  assert.equal(afterSession(sari, record(2, 7), NOW).nextAction.kind, "rest_contact");
  assert.equal(afterSession(sari, record(1, 4), NOW).nextAction.kind, "rest_contact");
  assert.equal(afterSession(sari, record(1, 2), NOW).nextAction.kind, "keep_going");
});

test("rising pain over three sessions suggests a check-in", () => {
  const budi = { ...cases()[0]!, plan: { ...cases()[0]!.plan, painThreshold: 9 } }; // last two pain-after scores: 5, 6
  const r = afterSession(budi, record(5, 7), NOW);
  assert.ok(r.alerts.some((a) => a.kind === "pain_rising"));
  assert.equal(r.nextAction.kind, "checkin_suggested");
  const r2 = afterSession(budi, record(4, 6), NOW);
  assert.equal(r2.alerts.some((a) => a.kind === "pain_rising"), false, "6 is not higher than 6");
});

test("daily checks: missed sessions and review due, without duplicates", () => {
  const liem = cases()[2]!; // last session 4 days ago, review tomorrow, missed alert already open
  const later = NOW + 1 * DAY;
  const alerts = daily(liem, later);
  assert.ok(alerts.some((a) => a.kind === "missed_sessions"));
  assert.ok(alerts.some((a) => a.kind === "review_due"));
  const before = liem.alerts.length;
  addAlerts(liem, alerts);
  assert.equal(liem.alerts.length, before + 1, "missed_sessions already open, only review_due added");
});

test("adherence and coach instructions", () => {
  const c = cases();
  const [budi, sari] = c;
  const tester = c.find((p) => p.id === "tester");
  assert.ok(weekAdherence(sari!, NOW)! > weekAdherence(budi!, NOW)!);
  assert.equal(weekAdherence(tester!, NOW), 0);
  const text = buildInstruction(budi!, { mode: "camera", askDiary: true }, coachContext(budi!));
  assert.match(text, /Pak Budi, 58/);
  assert.match(text, /Below-knee amputation, left leg/);
  assert.match(text, /1\. Angkat pinggul/);
  assert.match(text, /2\. Angkat kaki ke samping/);
  assert.match(text, /walk to the mosque/);
  assert.match(text, /The camera counts and checks every rep/);
});
