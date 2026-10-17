import { logActivity } from "#shared/activity";

// Care team: marks an alert as handled.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const alertId = getRouterParam(event, "alertId");
  // Role comes from the screen's header, never from the body (BUG-04).
  const actor = actorFrom(event);
  assertCan(actor, "alert.resolve");
  const role = actor.role as "physio" | "doctor";
  const p = await updatePatient(ws, id, (p) => {
    const a = p.alerts.find((a) => a.id === alertId);
    if (!a) throw createError({ statusCode: 404, statusMessage: "Alert not found." });
    assertCan(actor, "alert.resolve", { alert: a });
    a.resolvedAt = iso;
    a.resolvedBy = role;
    logActivity(p, { at: iso, actor: "human", who: role, action: "act_alert_resolved", params: { kind: a.kind }, refs: [{ kind: "alert", id: `${a.id}:done`, label: a.kind }] });
  });
  return p.alerts;
});
