import { pick } from "#shared/model";

// Care team: marks an alert as handled.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const alertId = getRouterParam(event, "alertId");
  const role = pick((await readBody(event))?.role, ["doctor", "physio"] as const, "physio");
  const p = await updatePatient(ws, id, (p) => {
    const a = p.alerts.find((a) => a.id === alertId);
    if (!a) throw createError({ statusCode: 404, statusMessage: "Alert not found." });
    a.resolvedAt = iso;
    a.resolvedBy = role;
  });
  return p.alerts;
});
