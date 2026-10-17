// Agent Activity Feed (FIS-08, DAT-07): who changed what, so the care team can trust the AI.
// Every writer adds one event: the AI (brief, proposal reason, coach memories), the rules (alerts,
// proposals, daily cycle) and people (plan saved, alert handled, proposal decided, notes in their words).

import { newId, type ActivityActor, type ActivityEvent, type Evidence, type Patient } from "./model";

export const ACTIVITY_MAX = 200;

/** Shown as the author of AI and rule events. */
export const WHO_AI = "Langkah AI";
export const WHO_RULES = "Rules";

export function logActivity(
  p: Patient,
  e: { at: string; actor: ActivityActor; who: string; action: string; params?: ActivityEvent["params"]; quote?: string | null; refs?: Evidence[]; groupId?: string | null },
): ActivityEvent {
  const ev: ActivityEvent = { id: newId(), at: e.at, actor: e.actor, who: e.who, action: e.action, params: e.params ?? {}, quote: e.quote ?? null, refs: e.refs ?? [], groupId: e.groupId ?? null };
  p.activity = [...(p.activity ?? []), ev].slice(-ACTIVITY_MAX);
  return ev;
}

/**
 * The feed, newest first. Events written before the feed existed (seed data, older copies) are
 * derived from the record so a new demo copy does not start empty; ids already logged are skipped.
 */
export function feedFor(p: Patient): ActivityEvent[] {
  const logged = new Set((p.activity ?? []).map((e) => e.refs[0]?.id).filter(Boolean));
  const derived: ActivityEvent[] = [];
  const add = (e: Omit<ActivityEvent, "id" | "groupId" | "quote"> & { quote?: string | null }) => {
    if (e.refs.some((r) => logged.has(r.id))) return;
    derived.push({ id: `d-${e.refs[0]?.id ?? newId()}`, groupId: null, quote: e.quote ?? null, ...e });
  };
  for (const m of p.memories) if (m.source === "coach") add({ at: m.createdAt, actor: "ai", who: WHO_AI, action: "act_memory", params: {}, quote: m.text, refs: [{ kind: "memory", id: m.id, label: m.kind }] });
  for (const d of p.diary) if (d.source === "coach") add({ at: d.at, actor: "ai", who: WHO_AI, action: "act_diary", params: { kind: d.kind, n: d.score ?? "–" }, quote: d.note || null, refs: [{ kind: "diary", id: d.id, label: d.kind }] });
  for (const c of p.skinChecks) add({ at: c.at, actor: "ai", who: WHO_AI, action: "act_skin", params: { urgency: c.result.urgency }, refs: [{ kind: "skin", id: c.id, label: c.area }] });
  for (const a of p.alerts) add({ at: a.at, actor: "rule", who: WHO_RULES, action: "act_alert", params: { kind: a.kind, severity: a.severity }, refs: [{ kind: "alert", id: a.id, label: a.kind }] });
  for (const n of p.notes)
    if (!n.private) add({ at: n.at, actor: "human", who: n.source === "family" ? "family" : "patient", action: n.via === "voice" ? "act_note_voice" : "act_note", params: { kind: n.kind }, quote: n.quote, refs: [{ kind: "note", id: n.id, label: n.kind }] });
  for (const t of p.familyTasks)
    if (t.doneAt) add({ at: t.doneAt, actor: "human", who: "family", action: "act_task_done", params: { title: typeof t.title === "string" ? t.title : t.title.en }, refs: [{ kind: "task", id: t.id, label: "task" }] });
  for (const s of p.sessions) add({ at: s.at, actor: "human", who: "patient", action: "act_session", params: { pain: `${s.painBefore ?? "?"}→${s.painAfter ?? "?"}` }, refs: [{ kind: "session", id: s.id, label: s.at.slice(0, 10) }] });
  return [...(p.activity ?? []), ...derived].sort((a, b) => b.at.localeCompare(a.at));
}
