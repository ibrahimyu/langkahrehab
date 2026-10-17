import { ROLES, newId, pick, str, type CheckIn } from "#shared/model";
import { can } from "#shared/permissions";

// Patient (or care team) asks for a check-in.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  assertCan(actorFrom(event), "checkin.request");
  const b = (await readBody(event)) ?? {};
  // DOK-05: the care team books a visit straight away (with a date), or puts back one it deleted (Undo).
  const care = can(actorFrom(event).role, "checkin.manage");
  const date = typeof b.scheduledFor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.scheduledFor) ? b.scheduledFor : null;
  if (care && b.restore && typeof b.restore.id === "string") {
    const r = b.restore;
    const restored: CheckIn = {
      id: str(r.id, 64), kind: pick(r.kind, ["doctor_review", "therapy"] as const, "therapy"), reason: str(r.reason, 300),
      requestedAt: str(r.requestedAt, 40) || iso, requestedBy: pick(r.requestedBy, ROLES, "doctor"), status: pick(r.status, ["requested", "scheduled", "done"] as const, "requested"),
      scheduledFor: str(r.scheduledFor, 40) || null, visitNote: str(r.visitNote, 2000), planVersion: Number.isInteger(r.planVersion) ? r.planVersion : null,
    };
    const p = await updatePatient(ws, id, (p) => {
      if (!p.checkIns.some((c) => c.id === restored.id)) p.checkIns = [...p.checkIns, restored].slice(-50);
    });
    return p.checkIns;
  }
  const checkIn: CheckIn = {
    id: newId(),
    kind: pick(b.kind, ["doctor_review", "therapy"] as const, "therapy"),
    reason: str(b.reason, 300),
    requestedAt: iso,
    requestedBy: actorFrom(event).role,
    status: care && date ? "scheduled" : "requested",
    scheduledFor: care ? date : null,
    visitNote: "",
    planVersion: null,
  };
  const p = await updatePatient(ws, id, (p) => {
    p.checkIns = [...p.checkIns, checkIn].slice(-50);
  });
  return p.checkIns;
});
