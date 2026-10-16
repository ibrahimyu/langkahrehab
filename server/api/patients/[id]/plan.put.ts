import { exerciseById } from "#shared/exercises";
import { pick, str, type Plan } from "#shared/model";

// Care team: saves a new plan version. The physio sets exercises and the note; the doctor sets
// the pain threshold and review date. The previous version goes to planHistory.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const body = (await readBody(event)) ?? {};
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter((i: any) => exerciseById(i?.exerciseId))
    .slice(0, 6)
    .map((i: any) => ({
      exerciseId: i.exerciseId,
      sets: Math.min(5, Math.max(1, Math.round(Number(i.sets) || 1))),
      reps: Math.min(30, Math.max(1, Math.round(Number(i.reps) || 1))),
    }));
  if (!items.length) throw bad("The plan needs at least one exercise.");
  const reviewDate = /^\d{4}-\d{2}-\d{2}$/.test(body.reviewDate) ? body.reviewDate : null;
  const p = await updatePatient(ws, id, (p) => {
    const plan: Plan = {
      version: p.plan.version + 1,
      items,
      note: str(body.note, 300),
      painThreshold: Math.min(10, Math.max(1, Math.round(Number(body.painThreshold) || p.plan.painThreshold))),
      reviewDate: reviewDate ?? p.plan.reviewDate,
      updatedAt: iso,
      updatedBy: pick(body.role, ["physio", "doctor"] as const, "physio"),
    };
    p.planHistory = [...p.planHistory, p.plan].slice(-20);
    p.plan = plan;
  });
  return p.plan;
});
