import type { H3Event } from "h3";
import { logActivity, WHO_AI, WHO_RULES } from "#shared/activity";
import { isoDate, newId, type Patient, type Workspace } from "#shared/model";
import { evaluateProgression, makeProposal, pendingProposal, templateRationale, type ProgressionResult } from "#shared/progression";
import { addAlerts, daily, makeAlert, moodAlert } from "#shared/rules";

/**
 * FIS-06: when the rules pass, add a pending proposal (template reason first) and its alert.
 * Returns the proposal id when one was made, so the caller can ask the AI for the reason.
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

/** AI-05: replaces the template reason with the AI's, when the AI answers. Never touches the changes. */
export async function explainProposal(event: H3Event, ws: string, patientId: string, proposalId: string, result: ProgressionResult, groupId: string | null) {
  const p = await getPatient(ws, patientId);
  if (!p) return;
  const ai = await proposalRationale(event, p, result);
  if (!ai) return;
  await updatePatient(ws, patientId, (q) => {
    const x = q.proposals.find((y) => y.id === proposalId);
    if (!x || x.status !== "pending") return;
    x.rationale = ai.rationale;
    x.rationaleBy = "ai";
    x.evidence = ai.evidence;
    logActivity(q, { at: x.createdAt, actor: "ai", who: WHO_AI, action: "act_proposal_reason", params: {}, quote: ai.rationale.en, refs: [{ kind: "proposal", id: x.id, label: "Proposal" }, ...ai.evidence], groupId });
  });
}

/** Runs promises with at most `n` at a time. */
async function limited<T>(jobs: (() => Promise<T>)[], n: number) {
  const queue = [...jobs];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await queue.shift()!().catch(() => undefined);
  }));
}

/**
 * SYS-03: the daily navigator cycle, idempotent per date (Workspace.lastDailyCycle).
 * Per patient: missed/review (daily), mood (SYS-07), progression (FIS-06), then one summary event in the
 * feed. AI reasons are written after the rules, three at a time, and the template stays if the AI fails.
 */
export async function runDailyCycle(event: H3Event, ws: string, workspace: Workspace, now: number) {
  const date = isoDate(new Date(now));
  if (workspace.lastDailyCycle === date) return { ran: false, date, alerts: 0, proposals: 0 };
  await setWorkspace(ws, { ...workspace, lastDailyCycle: date, triage: {} });
  let alerts = 0;
  let proposals = 0;
  const explain: (() => Promise<void>)[] = [];
  for (const patient of await listPatients(ws)) {
    const groupId = newId();
    await updatePatient(ws, patient.id, (q) => {
      const before = q.alerts.length;
      addAlerts(q, daily(q, now), groupId);
      const mood = moodAlert(q, now);
      if (mood) addAlerts(q, [mood], groupId);
      const { result, proposalId } = proposeIfReady(q, now, groupId);
      const newAlerts = q.alerts.length - before - (proposalId ? 1 : 0);
      alerts += Math.max(0, newAlerts);
      if (proposalId) {
        proposals++;
        explain.push(() => explainProposal(event, ws, q.id, proposalId, result, groupId));
      }
      logActivity(q, { at: new Date(now).toISOString(), actor: "rule", who: WHO_RULES, action: "act_daily", params: { alerts: Math.max(0, newAlerts), proposals: proposalId ? 1 : 0, date }, refs: [], groupId });
    });
  }
  await limited(explain, 3);
  return { ran: true, date, alerts, proposals };
}
