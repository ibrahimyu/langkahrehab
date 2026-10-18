import type { H3Event } from "h3";
import { logActivity, WHO_AI } from "#shared/activity";
import { dailyPatientStep, proposeIfReady as propose } from "#shared/daily";
import { isoDate, newId, type Patient, type Workspace } from "#shared/model";
import type { ProgressionResult } from "#shared/progression";

/** FIS-06 (shared/daily.ts): a pending proposal plus its low alert when the rules pass. */
export function proposeIfReady(p: Patient, now: number, groupId: string | null) {
  return propose(p, now, groupId);
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

/** DOK-04: the brief for tomorrow's visit, written by the cycle. A brief a person edited is never replaced. */
async function autoBrief(event: H3Event, ws: string, patientId: string, now: number, groupId: string) {
  const p = await getPatient(ws, patientId);
  if (!p || p.brief.editedAt) return;
  await aiBudget(event, "brief");
  const lang = p.brief.lang ?? "en";
  const { text } = await writeBrief(event, p, lang);
  const iso = new Date(now).toISOString();
  await updatePatient(ws, patientId, (q) => {
    if (q.brief.editedAt) return;
    q.brief = { text, lang, generatedAt: iso, editedAt: null, auto: true };
    logActivity(q, { at: iso, actor: "ai", who: WHO_AI, action: "act_brief_auto", refs: [{ kind: "plan", id: `brief-${iso}`, label: "Brief" }], groupId });
  });
}

/** Runs promises with at most `n` at a time; a failed job leaves the rule result (template) in place. */
export async function limited<T>(jobs: (() => Promise<T>)[], n: number) {
  const queue = [...jobs];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await queue.shift()!().catch(() => undefined);
  }));
}

export type DailyResult = { ran: boolean; date: string; alerts: number; proposals: number; briefs: number; tasks: number; ai: Promise<void> | null };

/**
 * SYS-03: the daily navigator cycle, idempotent per date (Workspace.lastDailyCycle).
 * Per patient (shared/daily.ts): missed/review, mood, progression, readiness and journey step, rule
 * family tasks, then one summary event in the feed. Then the notifications (SYS-11). The AI writes
 * afterwards, three at a time: proposal reasons (AI-05), tomorrow's briefs (DOK-04) and the triage per
 * role (AI-06). The caller gets the rule result at once; `ai` settles when the words are written.
 */
export async function runDailyCycle(event: H3Event, ws: string, workspace: Workspace, now: number): Promise<DailyResult> {
  const date = isoDate(new Date(now));
  const none = { date, alerts: 0, proposals: 0, briefs: 0, tasks: 0, ai: null };
  if (workspace.lastDailyCycle === date) return { ran: false, ...none };
  await setWorkspace(ws, { ...workspace, lastDailyCycle: date, triage: {} });
  const total = { alerts: 0, proposals: 0, briefs: 0, tasks: 0 };
  const jobs: (() => Promise<void>)[] = [];
  for (const patient of await listPatients(ws)) {
    const groupId = newId();
    await updatePatient(ws, patient.id, (q) => {
      const step = dailyPatientStep(q, now, groupId, date);
      total.alerts += step.alerts;
      total.tasks += step.tasks;
      if (step.proposalId) {
        total.proposals++;
        const { proposalId, result } = step;
        jobs.push(() => explainProposal(event, ws, q.id, proposalId, result, groupId));
      }
      if (step.briefDue) {
        total.briefs++;
        jobs.push(() => autoBrief(event, ws, q.id, now, groupId));
      }
    });
  }
  const patients = await listPatients(ws);
  await syncNotifications(ws, patients, now, getRequestURL(event).origin).catch(() => undefined);
  // One job for both roles: each saves into the same workspace document.
  jobs.push(async () => {
    for (const role of ["physio", "doctor"] as const) await buildTriage(event, ws, (await getWorkspace(ws)) ?? workspace, now, role, "en", patients, true);
  });
  const ai = limited(jobs, 3);
  return { ran: true, date, ...total, ai };
}
