// Goals and targets (PAS-14): the patient writes their own future; the physio confirms the steps
// that load the body. Pure functions so the server and the tests share the same rules.

import { GOAL_AREAS, newId, str, type Goal, type Role, type Target } from "./model";

const MAX_GOALS = 6;
const MAX_TARGETS = 10;

// Words that mean the target puts weight or strain on the body: the physio must OK it first.
// CLINICAL_REVIEW_NEEDED
const LOAD_WORDS = [
  "stand", "walk", "stairs", "step", "run", "jump", "kneel", "floor", "carry", "lift", "prosthesis", "without the walker", "bike", "cycle", "swim",
  "berdiri", "jalan", "berjalan", "tangga", "lari", "lompat", "berlutut", "lantai", "angkat", "mengangkat", "kaki palsu", "prostesis", "sepeda", "renang",
  "站", "走", "楼梯", "跑", "跳", "跪", "地上", "提", "假肢", "骑车", "游泳",
];
export const loadsBody = (text: string) => {
  const t = text.toLowerCase();
  return LOAD_WORDS.some((w) => t.includes(w));
};

/**
 * Applies an edit of the whole goal list from `role`, keeping what that role may not change.
 * - patient: writes goals and targets, marks targets done; cannot grant the physio's OK, and a
 *   body-loading target only counts as done after that OK.
 * - physio: may also grant or withdraw the OK.
 */
export function mergeGoals(existing: Goal[], incoming: unknown, role: Role, iso: string): Goal[] {
  const list = Array.isArray(incoming) ? incoming : [];
  const oldTargets = new Map(existing.flatMap((g) => g.targets).map((t) => [t.id, t]));
  const oldGoals = new Map(existing.map((g) => [g.id, g]));
  const goals = list.slice(0, MAX_GOALS).flatMap((g: any): Goal[] => {
    const text = str(g?.text, 160);
    if (!text) return [];
    const before = oldGoals.get(String(g?.id ?? ""));
    const targets = (Array.isArray(g?.targets) ? g.targets : []).slice(0, MAX_TARGETS).flatMap((t: any): Target[] => {
      const ttext = str(t?.text, 160);
      if (!ttext) return [];
      const prev = oldTargets.get(String(t?.id ?? ""));
      const needsPhysioOk = prev?.needsPhysioOk || loadsBody(ttext) || t?.needsPhysioOk === true;
      // Only the physio grants the OK; everyone else keeps the stored value.
      const physioOkAt = role === "physio" ? (t?.physioOkAt ? prev?.physioOkAt ?? iso : null) : prev?.physioOkAt ?? null;
      const wantsDone = !!t?.doneAt;
      const doneAt = wantsDone && (!needsPhysioOk || physioOkAt) ? prev?.doneAt ?? iso : null;
      const month = typeof t?.targetMonth === "string" && /^\d{4}-\d{2}$/.test(t.targetMonth) ? t.targetMonth : null;
      return [{ id: prev?.id ?? newId(), text: ttext, needsPhysioOk, physioOkAt, doneAt, targetMonth: month, source: prev?.source ?? (role === "physio" ? "physio" : "patient") }];
    });
    return [{
      id: before?.id ?? newId(),
      text,
      area: GOAL_AREAS.includes(g?.area) ? g.area : "other",
      main: !!g?.main,
      createdAt: before?.createdAt ?? iso,
      createdVia: before?.createdVia ?? (g?.createdVia === "voice" ? "voice" : role === "physio" || role === "doctor" ? "care_team" : "text"),
      targets,
    }];
  });
  // Exactly one main goal when there are goals.
  if (goals.length && !goals.some((g) => g.main)) goals[0]!.main = true;
  let seen = false;
  for (const g of goals) {
    if (g.main && seen) g.main = false;
    if (g.main) seen = true;
  }
  return goals;
}

/** The next step to work on: first target not done, in the main goal first. */
export function nextTarget(goals: Goal[]) {
  const ordered = [...goals].sort((a, b) => Number(b.main) - Number(a.main));
  for (const g of ordered) {
    const t = g.targets.find((x) => !x.doneAt);
    if (t) return { goal: g, target: t };
  }
  return null;
}

export const goalProgress = (g: Goal) => ({ done: g.targets.filter((t) => t.doneAt).length, total: g.targets.length });
