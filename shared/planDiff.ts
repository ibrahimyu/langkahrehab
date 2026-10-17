// What changed between two plan versions (FIS-04 diff before saving, FIS-05 Compare). Pure, so the
// editor, the history and the tests agree.

import type { Plan, PlanItem } from "./model";

export type PlanChange =
  | { kind: "added"; exerciseId: string; sets: number; reps: number }
  | { kind: "removed"; exerciseId: string }
  | { kind: "dose"; exerciseId: string; field: "sets" | "reps"; from: number; to: number }
  | { kind: "limit"; field: "painThreshold" | "reviewDate" | "maxSets" | "maxReps"; from: string; to: string }
  | { kind: "note"; from: string; to: string };

type PlanLike = Pick<Plan, "items" | "note" | "painThreshold" | "reviewDate"> & Partial<Pick<Plan, "maxSets" | "maxReps">>;

export function planDiff(before: PlanLike, after: PlanLike): PlanChange[] {
  const out: PlanChange[] = [];
  const old = new Map<string, PlanItem>(before.items.map((i) => [i.exerciseId, i]));
  const next = new Set(after.items.map((i) => i.exerciseId));
  for (const i of after.items) {
    const o = old.get(i.exerciseId);
    if (!o) out.push({ kind: "added", exerciseId: i.exerciseId, sets: i.sets, reps: i.reps });
    else {
      if (o.sets !== i.sets) out.push({ kind: "dose", exerciseId: i.exerciseId, field: "sets", from: o.sets, to: i.sets });
      if (o.reps !== i.reps) out.push({ kind: "dose", exerciseId: i.exerciseId, field: "reps", from: o.reps, to: i.reps });
    }
  }
  for (const o of before.items) if (!next.has(o.exerciseId)) out.push({ kind: "removed", exerciseId: o.exerciseId });
  for (const field of ["painThreshold", "reviewDate", "maxSets", "maxReps"] as const) {
    const a = String(before[field] ?? "–");
    const b = String(after[field] ?? "–");
    if (a !== b) out.push({ kind: "limit", field, from: a, to: b });
  }
  if (before.note !== after.note) out.push({ kind: "note", from: before.note, to: after.note });
  return out;
}
