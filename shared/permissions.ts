// Who may do what (docs/product/frd/01-peran-dan-izin.md, ROL-03). One table for the server
// (assertCan in server/utils/permissions.ts) and the interface (useCan), so they cannot drift apart.
// The physio owns exercises and doses; the doctor owns clinical limits and the profile.

import type { Alert, Note, Role } from "./model";

export const ACTIONS = [
  "patient.view",
  "plan.exercises",
  "plan.limits",
  "profile.edit",
  "session.save",
  "live.start",
  "diary.add",
  "memory.add",
  "memory.edit",
  "skin.check",
  "checkin.request",
  "checkin.manage",
  "alert.resolve",
  "brief.generate",
  "brief.edit",
  "goal.edit",
  "note.add",
  "note.manage",
  "note.review",
  "prefs.edit",
  "talk.use",
  "family.edit",
  "familyTask.do",
  "familyTask.edit",
  "familyQuestion.add",
  "familyUpdate.make",
  "familyUpdate.edit",
  "letter.send",
  "proposal.decide",
  "triage.view",
  "intake.review",
  "readiness.edit",
  "readiness.clear",
] as const;
export type Action = (typeof ACTIONS)[number];

const ALL: Role[] = ["patient", "family", "physio", "doctor"];
const CARE: Role[] = ["physio", "doctor"];

const matrix: Record<Action, Role[]> = {
  "patient.view": ALL,
  "plan.exercises": ["physio"],
  "plan.limits": ["doctor"],
  "profile.edit": ["doctor"],
  "session.save": ["patient"],
  "live.start": ["patient"],
  "diary.add": ["patient", ...CARE],
  "memory.add": ["patient", ...CARE],
  "memory.edit": CARE,
  "skin.check": ["patient", "family"],
  "checkin.request": ALL,
  "checkin.manage": CARE,
  "alert.resolve": CARE,
  "brief.generate": CARE,
  "brief.edit": CARE,
  // The patient writes their own goals; the physio adds steps and confirms body-loading ones.
  "goal.edit": ["patient", "physio"],
  "note.add": ["patient", "family"],
  // Only the patient hides or deletes their own notes; the care team reads, flags and answers them.
  "note.manage": ["patient"],
  "note.review": CARE,
  "prefs.edit": ["patient"],
  // Talk with Langkah is the patient's own space; the care team sees only the notes it produces.
  "talk.use": ["patient"],
  // Family (KEL): the patient, the family and the physio may keep the family list up to date.
  "family.edit": ["patient", "family", "physio"],
  "familyTask.do": ["family"],
  // Free-text tasks from the family are checked: body-loading jobs only come from templates.
  "familyTask.edit": ["family", "physio"],
  "familyQuestion.add": ["family"],
  // In the demo the family can refresh the weekly news (auto-share ON); the physio may rewrite it.
  "familyUpdate.make": ["family", ...CARE],
  "familyUpdate.edit": CARE,
  "letter.send": ["family"],
  // FIS-06: the physio approves, edits or rejects a progression proposal; the doctor only sees it.
  "proposal.decide": ["physio"],
  // AI-06: the morning list is for the care team only.
  "triage.view": CARE,
  // Doctor (DOK-01, DOK-03): discharge letter intake, fitting clearance. Per-criterion owners: shared/readiness.ts SETTERS.
  "intake.review": ["doctor"],
  "readiness.edit": CARE,
  "readiness.clear": ["doctor"],
};

/** Rules that depend on the object, on top of the table. */
export function can(role: Role, action: Action, ctx: { alert?: Pick<Alert, "for"> } = {}): boolean {
  if (!matrix[action].includes(role)) return false;
  // A physio handles alerts meant for the physio; the doctor may handle any alert.
  if (action === "alert.resolve" && role === "physio" && ctx.alert && !ctx.alert.for.includes("physio")) return false;
  return true;
}

/** Which plan fields belong to which action, for PUT /plan (one endpoint, two owners). */
export const PLAN_LIMIT_FIELDS = ["painThreshold", "reviewDate"] as const;
export const PLAN_EXERCISE_FIELDS = ["items", "note"] as const;

/** Notes a role may see (PAS-18): a note the patient made private is for the patient only. */
export const notesFor = (role: Role, notes: Note[]) => (role === "patient" ? notes : notes.filter((n) => !n.private));
