import { looksAfter } from "#shared/accounts";
import { pickLang, summarize, type CareRole, type TriageAction, type TriageCache } from "#shared/model";
import { careSignals, triage, type TriageReason } from "#shared/triage";

// AI-06 morning triage: one short sentence per patient on the care home. The rules (shared/triage.ts)
// decide who is listed and in which tier; the AI only words the reason. Cached per role per date
// and language in the workspace; without the AI the screen keeps its template reasons (by: "template").
const raw = (r: TriageReason): string =>
  r.kind === "alert" ? `${r.severity} alert: ${r.alert.replace("_", " ")}`
  : r.kind === "review" ? `review visit overdue by ${r.days} days`
  : r.kind === "missed" ? `no exercise for ${r.days} days`
  : r.kind === "goals_ok" ? `${r.n} goal steps wait for physio OK`
  : r.kind === "notes" ? `${r.n} unread notes from the patient`
  : r.kind === "urgent_note" ? "urgent note from the patient"
  : r.kind === "checkin" ? "patient asked for a check-in"
  : r.kind === "proposal" ? "progression proposal waits for a decision"
  : r.kind === "letter" ? "hospital letter from the family waits for review"
  : r.kind === "new_plan" ? "new plan from the doctor waits for the physio"
  : (r as { kind: string }).kind;
const ACTION: Partial<Record<TriageReason["kind"], TriageAction>> = {
  alert: "review_alert", urgent_note: "call_patient", goals_ok: "review_plan", checkin: "call_patient",
  review: "prepare_visit", missed: "call_patient", notes: "no_action", proposal: "approve_or_reject_proposal",
  letter: "prepare_visit", new_plan: "review_plan",
};

export default defineEventHandler(async (event) => {
  const actor = actorFrom(event);
  assertCan(actor, "triage.view");
  const role = actor.role as CareRole;
  const lang = pickLang(getQuery(event).lang);
  const fresh = getQuery(event).refresh === "1";
  const { ws, workspace, now } = await context(event);
  const date = new Date(now).toISOString().slice(0, 10);
  const patients = (await listPatients(ws)).filter((p) => looksAfter(actor.accountId, actor.role, p));
  const rows = patients.map((p) => ({ ...summarize(p), ...careSignals(p, now) }));
  const list = triage(rows, role, now);
  // Same day, language and the same reasons → the cached sentences still fit.
  const key = `${lang}|${list.map((t) => `${t.patient.id}:${JSON.stringify(t.reason)}`).join(",")}`;
  const cached = workspace.triage?.[role];
  if (!fresh && cached && cached.date === date && cached.key === key) return cached;
  const candidates = list.map((t) => {
    const p = patients.find((x) => x.id === t.patient.id)!;
    const reasons = [raw(t.reason)];
    if (t.patient.alerts.length > 1) reasons.push(`${t.patient.alerts.length} open alerts`);
    if (t.patient.unreadNotes && t.reason.kind !== "notes") reasons.push(`${t.patient.unreadNotes} unread notes`);
    reasons.push(`active ${t.patient.activeDays7} of the last 7 days`);
    if (p.familyTasks.some((f) => f.status === "open" && f.dueDate && f.dueDate < date)) reasons.push("family tasks overdue");
    return { patientId: t.patient.id, name: t.patient.name, tier: t.tier, reasons };
  });
  const ai = await triageSentences(event, lang, candidates);
  const result: TriageCache = ai && ai.length === candidates.length
    ? { date, key, by: "ai", items: ai.map((i) => ({ ...i, lang })) }
    : { date, key, by: "template", items: list.map((t) => ({ patientId: t.patient.id, reason: "", action: ACTION[t.reason.kind] ?? "no_action", lang })) };
  await setWorkspace(ws, { ...((await getWorkspace(ws)) ?? workspace), triage: { ...(workspace.triage ?? {}), [role]: result } });
  return result;
});
