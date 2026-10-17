import { logActivity } from "#shared/activity";
import { exerciseById } from "#shared/exercises";
import { expireStale } from "#shared/progression";
import { str, type Plan, type PlanItem } from "#shared/model";

// Care team: saves a new plan version. The physio owns exercises, doses and the note; the doctor owns
// the clinical limits: pain threshold, review date and the highest dose (DOK-02). The server compares
// what changed with who is asking (ROL-03), and fields left out keep their current value (BUG-07).
// The previous version goes to planHistory.
const sameItems = (a: PlanItem[], b: PlanItem[]) =>
  a.length === b.length && a.every((x, i) => x.exerciseId === b[i]!.exerciseId && x.sets === b[i]!.sets && x.reps === b[i]!.reps);

const limit = (v: unknown, max: number, now: number | null) =>
  v === undefined ? now : v === null || v === "" ? null : Math.min(max, Math.max(1, Math.round(Number(v) || max)));

export default defineEventHandler(async (event) => {
  const { ws, id, iso, patient } = await patientContext(event);
  const actor = actorFrom(event);
  const body = (await readBody(event)) ?? {};
  const now = patient.plan;

  const maxSets = limit(body.maxSets, 5, now.maxSets ?? null);
  const maxReps = limit(body.maxReps, 30, now.maxReps ?? null);
  const items: PlanItem[] = Array.isArray(body.items)
    ? body.items
        .filter((i: any) => exerciseById(i?.exerciseId))
        .slice(0, 6)
        .map((i: any) => ({
          exerciseId: i.exerciseId,
          sets: Math.min(5, Math.max(1, Math.round(Number(i.sets) || 1))),
          reps: Math.min(30, Math.max(1, Math.round(Number(i.reps) || 1))),
        }))
    : now.items;
  if (!items.length) throw bad("The plan needs at least one exercise.");
  // The doctor's highest dose (FIS-04): a new dose above it is refused, not silently lowered.
  if (Array.isArray(body.items)) {
    if (maxSets && items.some((i) => i.sets > maxSets)) throw bad(`Above the doctor's limit: at most ${maxSets} sets.`);
    if (maxReps && items.some((i) => i.reps > maxReps)) throw bad(`Above the doctor's limit: at most ${maxReps} reps.`);
  }
  const note = typeof body.note === "string" ? str(body.note, 300) : now.note;
  const perDay = body.perDay === undefined ? now.perDay ?? 1 : Math.min(3, Math.max(1, Math.round(Number(body.perDay) || 1)));
  const daysPerWeek = body.daysPerWeek === undefined ? now.daysPerWeek ?? 7 : Math.min(7, Math.max(1, Math.round(Number(body.daysPerWeek) || 7)));
  const painThreshold = body.painThreshold === undefined ? now.painThreshold : Math.min(10, Math.max(1, Math.round(Number(body.painThreshold) || now.painThreshold)));
  const reviewDate = typeof body.reviewDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.reviewDate) ? body.reviewDate : now.reviewDate;

  if (!sameItems(items, now.items) || note !== now.note || perDay !== (now.perDay ?? 1) || daysPerWeek !== (now.daysPerWeek ?? 7)) assertCan(actor, "plan.exercises");
  if (painThreshold !== now.painThreshold || reviewDate !== now.reviewDate || maxSets !== (now.maxSets ?? null) || maxReps !== (now.maxReps ?? null))
    assertCan(actor, "plan.limits");

  const p = await updatePatient(ws, id, (p) => {
    const plan: Plan = {
      version: p.plan.version + 1,
      items,
      note,
      perDay,
      daysPerWeek,
      painThreshold,
      reviewDate,
      maxSets,
      maxReps,
      source: "manual",
      // DOK-01: plan v1 from a letter waits for the physio; a save by the doctor keeps it waiting.
      ...(actor.role === "doctor" && p.plan.awaitingPhysio ? { awaitingPhysio: true } : {}),
      updatedAt: iso,
      updatedBy: actor.role === "doctor" ? "doctor" : "physio",
    };
    p.planHistory = [...p.planHistory, p.plan].slice(-20);
    p.plan = plan;
    // A pending proposal was made for the old version (DAT-05): it expires.
    expireStale(p, iso);
    logActivity(p, { at: iso, actor: "human", who: plan.updatedBy, action: "act_plan", params: { v: plan.version }, refs: [{ kind: "plan", id: `v${plan.version}`, label: `Plan v${plan.version}` }] });
  });
  return p.plan;
});
