import { logActivity } from "#shared/activity";

// Care team: marks an alert as handled. `{ reopen: true }` undoes that (the Undo in the toast).
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const alertId = getRouterParam(event, "alertId");
  const body = ((await readBody(event).catch(() => null)) ?? {}) as { reopen?: boolean };
  // Role comes from the screen's header, never from the body (BUG-04).
  const actor = actorFrom(event);
  assertCan(actor, "alert.resolve");
  const role = actor.role as "physio" | "doctor";
  const p = await updatePatient(ws, id, (p) => {
    const a = p.alerts.find((a) => a.id === alertId);
    if (!a) throw createError({ statusCode: 404, statusMessage: "Alert not found." });
    assertCan(actor, "alert.resolve", { alert: a });
    if (body.reopen === true) {
      a.resolvedAt = null;
      a.resolvedBy = null;
      p.activity = (p.activity ?? []).filter((e) => !e.refs?.some((r) => r.kind === "alert" && r.id === `${a.id}:done`));
      return;
    }
    a.resolvedAt = iso;
    a.resolvedBy = role;
    logActivity(p, { at: iso, actor: "human", who: role, action: "act_alert_resolved", params: { kind: a.kind }, refs: [{ kind: "alert", id: `${a.id}:done`, label: a.kind }] });
  });
  return p.alerts;
});
