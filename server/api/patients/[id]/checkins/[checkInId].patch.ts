import { logActivity } from "#shared/activity";
import { pick, str } from "#shared/model";

// Care team: schedules a check-in or records the visit.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "checkin.manage");
  const checkInId = getRouterParam(event, "checkInId");
  const b = (await readBody(event)) ?? {};
  const p = await updatePatient(ws, id, (p) => {
    const c = p.checkIns.find((c) => c.id === checkInId);
    if (!c) throw createError({ statusCode: 404, statusMessage: "Check-in not found." });
    const wasDone = c.status === "done";
    if (b.status) c.status = pick(b.status, ["requested", "scheduled", "done"] as const, c.status);
    const ref = { kind: "plan" as const, id: `checkin-${c.id}`, label: c.kind };
    if (b.scheduledFor !== undefined) {
      // DOK-05: a date (YYYY-MM-DD) from the date picker; null clears it.
      const date = typeof b.scheduledFor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.scheduledFor) ? b.scheduledFor : null;
      if (b.scheduledFor && !date) throw bad("Pick a date.");
      if (date && date !== c.scheduledFor) logActivity(p, { at: iso, actor: "human", who: actor.role, action: "act_checkin_booked", params: { date }, refs: [ref] });
      c.scheduledFor = date;
      if (date && c.status === "requested" && !b.status) c.status = "scheduled";
    }
    if (b.visitNote !== undefined) c.visitNote = str(b.visitNote, 2000);
    // The plan in force at the visit, fixed when the visit is closed (later note edits keep it).
    if (c.status === "done" && !wasDone) {
      c.planVersion = p.plan.version;
      logActivity(p, { at: iso, actor: "human", who: actor.role, action: "act_checkin_done", params: { v: p.plan.version }, refs: [ref, { kind: "plan", id: `v${p.plan.version}`, label: `Plan v${p.plan.version}` }] });
    }
    if (c.status !== "done") c.planVersion = null;
  });
  return p.checkIns;
});
