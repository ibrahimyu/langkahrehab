// SYS-03: the rule half of the daily navigator cycle, pure so it can be tested. The server
// (server/utils/daily.ts) runs it per patient inside one save, then asks the AI for the words
// (proposal reasons, the brief for tomorrow's visit, triage sentences) at most three at a time.

import { logActivity, WHO_RULES } from "./activity";
import { addDays, dayKey } from "./calendar";
import { capTasks, generateFamilyTasks } from "./family";
import { computeJourneyStage } from "./journey";
import { isoDate, type Evidence, type Patient } from "./model";
import { evaluateProgression, makeProposal, pendingProposal, templateRationale, type ProgressionResult } from "./progression";
import { refreshReadiness } from "./readiness";
import { addAlerts, daily, makeAlert, moodAlert, reviewDay } from "./rules";

/**
 * FIS-06: when the rules pass, add a pending proposal (template reason first) and its low alert for
 * the physio. Returns the proposal id when one was made, so the caller can ask the AI for the reason.
 */
export function proposeIfReady(p: Patient, now: number, groupId: string | null): { result: ProgressionResult; proposalId: string | null } {
  const result = evaluateProgression(p, now);
  const at = new Date(now).toISOString();
  if (result.atMax) {
    const already = p.activity.some((e) => e.action === "act_at_max" && e.params.v === p.plan.version);
    if (!already) logActivity(p, { at, actor: "rule", who: WHO_RULES, action: "act_at_max", params: { v: p.plan.version }, refs: [{ kind: "plan", id: `v${p.plan.version}`, label: `Plan v${p.plan.version}` }], groupId });
    return { result, proposalId: null };
  }
  if (!result.eligible || pendingProposal(p)) return { result, proposalId: null };
  const proposal = makeProposal(p, result, at, templateRationale(p, result), "template");
  p.proposals = [...p.proposals, proposal].slice(-20);
  const ref = { kind: "proposal" as const, id: proposal.id, label: `Proposal for plan v${p.plan.version}` };
  logActivity(p, { at, actor: "rule", who: WHO_RULES, action: "act_proposal_made", params: { n: result.changes.length }, refs: [ref, ...result.evidence.slice(-3)], groupId });
  addAlerts(p, [makeAlert("proposal_pending", "low", { key: "alert_proposal_pending" }, ["physio"], at)], groupId);
  return { result, proposalId: proposal.id };
}

/** FIS-06: closes the open `proposal_pending` alert once the proposal is decided. Returns how many closed. */
export function resolveProposalAlerts(p: Patient, iso: string, by: "physio" | "doctor" = "physio"): number {
  let n = 0;
  for (const a of p.alerts)
    if (a.kind === "proposal_pending" && !a.resolvedAt) {
      Object.assign(a, { resolvedAt: iso, resolvedBy: by });
      n++;
    }
  return n;
}

/** DOK-04: the brief is written the day before the review visit, unless it is already fresh or a person edited it. */
export function briefDue(p: Patient, now: number): boolean {
  const today = dayKey(now);
  if (reviewDay(p) !== addDays(today, 1)) return false;
  if (p.brief.editedAt) return false;
  return !p.brief.generatedAt || dayKey(Date.parse(p.brief.generatedAt)) < today;
}

export type DailyStep = {
  alerts: number;
  proposalId: string | null;
  result: ProgressionResult;
  tasks: number;
  stage: { from: number; to: number };
  briefDue: boolean;
};

/**
 * One patient's daily rules, in order: missed/review, mood (SYS-07), progression (FIS-06), readiness
 * signals and the journey step (DOK-03), rule-based family tasks, whether tomorrow's brief is due.
 * Ends with one summary event in the feed (FIS-08) that groups everything this run wrote (`groupId`).
 * Idempotent on the same day: open alerts, a pending proposal and open tasks are never added twice.
 */
export function dailyPatientStep(p: Patient, now: number, groupId: string, date = isoDate(new Date(now))): DailyStep {
  const at = new Date(now).toISOString();
  const alertIds = new Set(p.alerts.map((a) => a.id));
  addAlerts(p, daily(p, now), groupId);
  const mood = moodAlert(p, now);
  if (mood) addAlerts(p, [mood], groupId);
  const { result, proposalId } = proposeIfReady(p, now, groupId);

  const from = computeJourneyStage(p);
  refreshReadiness(p, now);
  const to = computeJourneyStage(p);
  if (to !== from) logActivity(p, { at, actor: "rule", who: WHO_RULES, action: "act_stage", params: { from, to }, refs: [{ kind: "plan", id: `stage-${to}-${date}`, label: `Step ${to}` }], groupId });

  const made = generateFamilyTasks(p, now);
  if (made.length) {
    p.familyTasks = capTasks([...p.familyTasks, ...made]);
    logActivity(p, { at, actor: "rule", who: WHO_RULES, action: "act_tasks_rule", params: { n: made.length }, refs: made.map((t) => ({ kind: "task" as const, id: t.id, label: typeof t.title === "string" ? t.title : t.title.en })), groupId });
  }

  const due = briefDue(p, now);
  const newAlerts = p.alerts.filter((a) => !alertIds.has(a.id));
  const counted = newAlerts.filter((a) => a.kind !== "proposal_pending");
  const refs: Evidence[] = [
    ...counted.map((a) => ({ kind: "alert" as const, id: a.id, label: a.kind })),
    ...(proposalId ? [{ kind: "proposal" as const, id: proposalId, label: "Proposal" }] : []),
    ...made.map((t) => ({ kind: "task" as const, id: t.id, label: "task" })),
  ];
  const logged = p.activity.some((e) => e.action === "act_daily" && e.params.date === date);
  if (!logged) logActivity(p, {
    at, actor: "rule", who: WHO_RULES, action: "act_daily",
    params: { alerts: counted.length, proposals: proposalId ? 1 : 0, briefs: due ? 1 : 0, tasks: made.length, date },
    refs: [{ kind: "plan", id: `daily-${date}`, label: `Daily check ${date}` }, ...refs],
    groupId,
  });
  return { alerts: counted.length, proposalId, result, tasks: made.length, stage: { from, to }, briefDue: due };
}

/** True when the daily cycle has not run yet for this date. */
export const dailyDue = (w: { lastDailyCycle?: string | null }, now: number) => w.lastDailyCycle !== isoDate(new Date(now));
