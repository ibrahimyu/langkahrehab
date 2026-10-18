import { test } from "node:test";
import assert from "node:assert/strict";
import { seedCases } from "../shared/cases";
import { briefDue, dailyDue, dailyPatientStep, proposeIfReady, resolveProposalAlerts } from "../shared/daily";
import { DAY, newId, type DiaryEntry, type Patient, type SessionRecord } from "../shared/model";
import { evaluateProgression } from "../shared/progression";
import { lowMoodStreak, makeAlert, moodAlert } from "../shared/rules";
import { eventNotifications } from "../shared/notifications";

const NOW = Date.parse("2026-10-16T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

/** A patient who passes every progression rule: 6 easy sessions this week, low pain, a stable plan. */
function ready(): Patient {
  const p = seedCases(NOW).find((x) => x.id === "budi")!;
  p.alerts = [];
  p.proposals = [];
  p.activity = [];
  p.plan.painThreshold = 7;
  p.plan.updatedAt = iso(NOW - 10 * DAY);
  p.plan.maxSets = null as unknown as number;
  p.plan.maxReps = null as unknown as number;
  p.sessions = Array.from({ length: 6 }, (_, i): SessionRecord => ({
    id: newId(), at: iso(NOW - (i + 1) * DAY + 3600_000), planVersion: p.plan.version, lang: "en", mode: "camera",
    exercises: p.plan.items.map((it) => ({ exerciseId: it.exerciseId, sets: it.sets, reps: it.reps, logged: Array(it.sets).fill(it.reps) })),
    painBefore: 1, painAfter: 2, difficulty: "ok", concern: null, nextAction: { kind: "keep_going" }, source: "session",
  }));
  return p;
}

const mood = (score: number, daysAgo: number): DiaryEntry => ({ id: newId(), kind: "mood", score, note: "", source: "coach", at: iso(NOW - daysAgo * DAY) });

// FIS-06
test("FIS-06: eligible patient gets one proposal and a low proposal_pending alert for the physio", () => {
  const p = ready();
  const r = proposeIfReady(p, NOW, null);
  assert.ok(r.result.eligible, JSON.stringify(r.result.eligibility.filter((e) => !e.passed)));
  assert.ok(r.proposalId);
  assert.equal(p.proposals.length, 1);
  const a = p.alerts.find((x) => x.kind === "proposal_pending")!;
  assert.equal(a.severity, "low");
  assert.deepEqual(a.for, ["physio"]);
});

test("FIS-06: not eligible when pain after a session is too high", () => {
  const p = ready();
  p.sessions.at(-1)!.painAfter = 6;
  const r = evaluateProgression(p, NOW);
  assert.equal(r.eligible, false);
  assert.equal(r.eligibility.find((e) => e.rule === "pain")!.passed, false);
  assert.equal(proposeIfReady(p, NOW, null).proposalId, null);
});

test("FIS-06: not eligible while a recent alert is open", () => {
  const p = ready();
  p.alerts.push(makeAlert("pain_high", "high", "pain", ["physio"], iso(NOW - DAY)));
  const r = evaluateProgression(p, NOW);
  assert.equal(r.eligibility.find((e) => e.rule === "alerts")!.passed, false);
  assert.equal(proposeIfReady(p, NOW, null).proposalId, null);
});

test("FIS-06: at the doctor's limit no proposal is made", () => {
  const p = ready();
  p.plan.maxSets = Math.max(...p.plan.items.map((i) => i.sets));
  p.plan.maxReps = Math.max(...p.plan.items.map((i) => i.reps));
  for (const i of p.plan.items) Object.assign(i, { sets: p.plan.maxSets, reps: p.plan.maxReps });
  for (const s of p.sessions) s.exercises = p.plan.items.map((it) => ({ exerciseId: it.exerciseId, sets: it.sets, reps: it.reps, logged: Array(it.sets).fill(it.reps) }));
  const r = proposeIfReady(p, NOW, null);
  assert.equal(r.result.atMax, true);
  assert.equal(r.proposalId, null);
  assert.equal(p.proposals.length, 0);
});

test("FIS-06: no second proposal while one is pending; deciding closes the alert", () => {
  const p = ready();
  proposeIfReady(p, NOW, null);
  assert.equal(proposeIfReady(p, NOW + DAY, null).proposalId, null);
  assert.equal(p.proposals.length, 1);
  assert.equal(p.alerts.filter((a) => a.kind === "proposal_pending").length, 1);
  assert.equal(resolveProposalAlerts(p, iso(NOW)), 1);
  assert.ok(p.alerts.every((a) => a.kind !== "proposal_pending" || a.resolvedAt));
});

// SYS-07
test("SYS-07: three low moods in a row raise one wellbeing alert", () => {
  const p = ready();
  p.diary = [mood(2, 3), mood(1, 2), mood(3, 1)];
  assert.equal(lowMoodStreak(p.diary), true);
  const a = moodAlert(p, NOW)!;
  assert.equal(a.kind, "wellbeing");
  assert.deepEqual(a.for, ["physio"]);
  p.alerts.push(a);
  assert.equal(moodAlert(p, NOW), null, "one open at a time");
});

test("SYS-07: a normal mood in between breaks the streak", () => {
  const p = ready();
  p.diary = [mood(2, 4), mood(1, 3), mood(7, 2), mood(3, 1)];
  assert.equal(lowMoodStreak(p.diary), false);
  assert.equal(moodAlert(p, NOW), null);
});

// SYS-03
test("SYS-03: the daily step twice on the same date adds no alerts, proposals, tasks or summaries", () => {
  const p = ready();
  p.sessions = p.sessions.map((s) => ({ ...s, at: iso(NOW - 6 * DAY) })); // missed days → an alert
  p.diary = [mood(2, 3), mood(1, 2), mood(3, 1)];
  const first = dailyPatientStep(p, NOW, "g1");
  assert.ok(first.alerts >= 1);
  const snapshot = { alerts: p.alerts.length, proposals: p.proposals.length, tasks: p.familyTasks.length };
  const second = dailyPatientStep(p, NOW, "g2");
  assert.equal(second.alerts, 0);
  assert.equal(second.proposalId, null);
  assert.equal(second.tasks, 0);
  assert.deepEqual({ alerts: p.alerts.length, proposals: p.proposals.length, tasks: p.familyTasks.length }, snapshot);
  assert.equal(p.activity.filter((e) => e.action === "act_daily").length, 1);
});

test("SYS-03: the summary event groups what the run wrote and links to it", () => {
  const p = ready();
  const step = dailyPatientStep(p, NOW, "g1");
  assert.ok(step.proposalId);
  const sum = p.activity.find((e) => e.action === "act_daily")!;
  assert.equal(sum.actor, "rule");
  assert.equal(sum.groupId, "g1");
  assert.equal(sum.params.proposals, 1);
  assert.ok(sum.refs.some((r) => r.kind === "proposal" && r.id === step.proposalId));
  assert.ok(p.activity.filter((e) => e.groupId === "g1").length >= 2);
});

test("SYS-03: the workspace guard runs the cycle once per date", () => {
  assert.equal(dailyDue({}, NOW), true);
  assert.equal(dailyDue({ lastDailyCycle: "2026-10-16" }, NOW), false);
  assert.equal(dailyDue({ lastDailyCycle: "2026-10-15" }, NOW), true);
});

test("DOK-04: the brief is due the day before the review, never over an edited one", () => {
  const p = ready();
  p.checkIns = [];
  p.plan.reviewDate = "2026-10-17";
  p.brief = { text: "", lang: "en", generatedAt: null, editedAt: null };
  assert.equal(briefDue(p, NOW), true);
  p.brief.editedAt = iso(NOW - DAY);
  assert.equal(briefDue(p, NOW), false);
  p.brief = { text: "x", lang: "en", generatedAt: iso(NOW), editedAt: null };
  assert.equal(briefDue(p, NOW), false, "already written today");
});

test("DOK-03: clearing for fitting tells each family member once", () => {
  const p = ready();
  assert.ok(p.family.length > 0);
  p.clearedForFittingAt = iso(NOW - DAY);
  const drafts = eventNotifications(p, [], NOW).filter((n) => n.kind === "journey_step");
  assert.equal(drafts.length, p.family.length);
  assert.ok(drafts.every((d) => d.to.role === "family" && !JSON.stringify(d.params).match(/\d/)));
});
