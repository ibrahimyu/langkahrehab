// Discharge letter intake (DOK-01, AI-03, DAT-10): what is read from one photo, how it is checked,
// and what the doctor's Confirm creates. Pure, so the server, the review screen and the tests agree.
// The image itself is never part of an Intake.

import type { Lang } from "./exercises";
import { generateFamilyTasks, loadsBody, sanitizeMember } from "./family";
import { LOWER_LEVELS, UPPER_LEVELS, legacyFields, limbsOf, type LimbLevel } from "./limbs";
import { firstPlan } from "./patients";
import {
  CAUSES,
  DAY,
  defaultPreferences,
  emptyReadiness,
  isoDate,
  newId,
  str,
  type ActivityEvent,
  type CheckIn,
  type FamilyMember,
  type FamilyTask,
  type Patient,
  type Plan,
  type PlanItem,
  type Profile,
  type Role,
} from "./model";

export const INTAKE_FIELDS = [
  "patientName", "age", "sex", "amputationSide", "amputationLevel", "cause",
  "surgeryDate", "comorbidities", "restrictions", "nextVisitDate", "hospital",
] as const;
export type IntakeField = (typeof INTAKE_FIELDS)[number];
export const REQUIRED_FIELDS: IntakeField[] = ["patientName", "age", "amputationSide", "amputationLevel"];
export const SEXES = ["female", "male"] as const;
export const SIDES = ["left", "right"] as const;
/** Every leg and arm level (shared/limbs.ts), or "other" when the letter says something else. */
export const INTAKE_LEVELS = [...LOWER_LEVELS, ...UPPER_LEVELS, "other"] as const;
/** Below this the review screen asks the doctor to check the field. */
export const CONFIDENT = 0.7;

export type FieldValue = { value: string | number | null; confidence: number; edited: boolean };
export type IntakeFamily = Pick<FamilyMember, "name" | "relation" | "livesWithPatient">;
/** One page of a letter: a photo (JPEG, PNG, WebP) or a PDF, as a data URL. */
export const LETTER_PAGE = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/;
export const LETTER_MAX_PAGES = 6;
/** About 9 MB for all pages together. */
export const LETTER_MAX_CHARS = 12_000_000;
/** The pages that are valid, up to the limits; null when there are none or they are too large. */
export function sanitizePages(raw: unknown): string[] | null {
  const pages = (Array.isArray(raw) ? raw : [raw]).filter((x): x is string => typeof x === "string" && LETTER_PAGE.test(x)).slice(0, LETTER_MAX_PAGES);
  if (!pages.length || pages.reduce((n, x) => n + x.length, 0) > LETTER_MAX_CHARS) return null;
  return pages;
}

/** The letter in everyday words for the patient and family, checked by the doctor before they see it. */
export type LetterExplanation = { what: string; homeCare: string[]; warningSigns: string[]; visits: string[] };
const lines = (v: unknown, max: number) => (Array.isArray(v) ? v : []).map((x) => str(x, 240)).filter(Boolean).slice(0, max);
export function sanitizeExplanation(raw: any): LetterExplanation | null {
  const e = { what: str(raw?.what, 600), homeCare: lines(raw?.homeCare, 8), warningSigns: lines(raw?.warningSigns, 8), visits: lines(raw?.visits, 6) };
  return e.what || e.homeCare.length || e.warningSigns.length || e.visits.length ? e : null;
}

/** A job for the family suggested from the letter's home advice; the doctor ticks the ones to send. */
export type SuggestedTask = { title: string; detail: string; item: boolean; selected: boolean };

export type Intake = {
  id: string;
  createdAt: string;
  uploadedBy: Role;
  status: "awaiting_doctor" | "confirmed" | "discarded";
  fields: Record<IntakeField, FieldValue>;
  /** Copied from the letter for the team to read. Never used by Langkah, never sent to the coach. */
  medicationsMentioned: string[];
  /** From the letter's advice for home (wound care, papers, visits); never medicine, standing or walking. */
  suggestedTasks?: SuggestedTask[];
  /** Plain words for the patient and family; the doctor can edit it before Confirm. */
  explanation?: LetterExplanation | null;
  family: IntakeFamily[];
  lang: Lang;
  /** Set for a letter the family sent for an existing patient (DOK-07). */
  patientId: string | null;
  letterId: string | null;
  /** "ai" = read by Gemini, "sample" = stored output for a demo letter, "manual" = AI unavailable. */
  readBy: "ai" | "sample" | "manual";
  sample: string | null;
  confirmedAt: string | null;
  updatedAt: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v: unknown) => typeof v === "string" && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const clamp01 = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));

/** One field's value, checked against its type; anything outside the allowed values is null. */
export function cleanValue(field: IntakeField, v: unknown): string | number | null {
  if (v === null || v === undefined || v === "") return null;
  switch (field) {
    case "age": {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 1 && n <= 110 ? n : null;
    }
    case "sex": return (SEXES as readonly string[]).includes(v as string) ? (v as string) : null;
    case "amputationSide": return (SIDES as readonly string[]).includes(v as string) ? (v as string) : null;
    case "amputationLevel": return (INTAKE_LEVELS as readonly string[]).includes(v as string) ? (v as string) : null;
    case "cause": return (CAUSES as readonly string[]).includes(v as string) ? (v as string) : null;
    case "surgeryDate":
    case "nextVisitDate": return validDate(v) ? (v as string) : null;
    case "patientName": return str(v, 80) || null;
    case "hospital": return str(v, 120) || null;
    default: return str(v, 400) || null;
  }
}

/** The model's answer made safe (AI-03): clamp confidence, enums and dates checked, null = confidence 0. */
export function sanitizeTasks(raw: unknown): SuggestedTask[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x: any) => ({ title: str(x?.title, 120), detail: str(x?.detail, 400), item: !!x?.item, selected: x?.selected === undefined ? true : !!x.selected }))
    .filter((x) => x.title && !loadsBody(`${x.title} ${x.detail}`) && !/\b(obat|minum|dosis|medicine|tablet|mg)\b/i.test(`${x.title} ${x.detail}`))
    .slice(0, 6);
}

export function sanitizeExtraction(raw: any): { fields: Record<IntakeField, FieldValue>; medicationsMentioned: string[]; suggestedTasks: SuggestedTask[]; explanation: LetterExplanation | null } {
  const fields = {} as Record<IntakeField, FieldValue>;
  for (const f of INTAKE_FIELDS) {
    const value = cleanValue(f, raw?.[f]?.value);
    fields[f] = { value, confidence: value === null ? 0 : clamp01(raw?.[f]?.confidence), edited: false };
  }
  const meds = raw?.medicationsMentioned?.value ?? raw?.medicationsMentioned;
  const medicationsMentioned = (Array.isArray(meds) ? meds : []).map((m: unknown) => str(m, 120)).filter(Boolean).slice(0, 20);
  return { fields, medicationsMentioned, suggestedTasks: sanitizeTasks(raw?.familyTasks), explanation: sanitizeExplanation(raw?.explanation) };
}

export const emptyFields = (): Record<IntakeField, FieldValue> =>
  Object.fromEntries(INTAKE_FIELDS.map((f) => [f, { value: null, confidence: 0, edited: false }])) as Record<IntakeField, FieldValue>;

/** The doctor's edits: a changed value becomes confidence 1 and edited. */
export function applyEdits(current: Record<IntakeField, FieldValue>, values: any): Record<IntakeField, FieldValue> {
  const next = structuredClone(current);
  if (!values || typeof values !== "object") return next;
  for (const f of INTAKE_FIELDS) {
    if (!(f in values)) continue;
    const value = cleanValue(f, values[f]);
    if (value === next[f].value) continue;
    next[f] = { value, confidence: value === null ? 0 : 1, edited: true };
  }
  return next;
}

export const sanitizeFamily = (list: unknown, lang: Lang): IntakeFamily[] =>
  (Array.isArray(list) ? list : [])
    .map((m) => sanitizeMember(m, lang))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .slice(0, 6)
    .map((m) => ({ name: m.name, relation: m.relation, livesWithPatient: m.livesWithPatient }));

export const needsCheck = (f: FieldValue) => f.value === null || f.confidence < CONFIDENT;

/** Required fields still empty (Confirm stays disabled and names them). "other" level needs a choice. */
export function missingRequired(fields: Record<IntakeField, FieldValue>): IntakeField[] {
  return REQUIRED_FIELDS.filter((f) => fields[f].value === null || (f === "amputationLevel" && fields[f].value === "other"));
}

// CLINICAL_REVIEW_NEEDED: starting plan v1 by level, reviewed by the physio before it is used.
export function planTemplate(level: "below_knee" | "above_knee"): PlanItem[] {
  const reps = level === "below_knee" ? 10 : 8;
  return [
    { exerciseId: "bridging", sets: 2, reps },
    { exerciseId: "side-lying-abduction", sets: 2, reps },
    { exerciseId: "prone-hip-extension", sets: 2, reps: 8 },
  ];
}

const v = <T>(fields: Record<IntakeField, FieldValue>, f: IntakeField) => fields[f].value as T | null;

function profileFrom(fields: Record<IntakeField, FieldValue>, base?: Profile): Profile {
  const level = v<string>(fields, "amputationLevel");
  const side = v<"left" | "right">(fields, "amputationSide") ?? base?.side ?? "left";
  const site = (UPPER_LEVELS as readonly string[]).includes(level ?? "") ? "upper" : "lower";
  const limbs = level && level !== "other" ? [{ site, side, level: level as LimbLevel } as const] : base ? limbsOf(base) : [{ site: "lower", side, level: "below_knee" } as const];
  return {
    limbs: [...limbs],
    ...legacyFields([...limbs], side),
    stage: base?.stage ?? "pre_prosthetic",
    cause: v<Profile["cause"]>(fields, "cause") ?? base?.cause ?? "unknown",
    restrictions: v<string>(fields, "restrictions") ?? base?.restrictions ?? "",
    comorbidities: v<string>(fields, "comorbidities") ?? base?.comorbidities ?? "",
    surgeryDate: v<string>(fields, "surgeryDate") ?? base?.surgeryDate ?? null,
  };
}

const visitCheckIn = (date: string, iso: string): CheckIn => ({
  id: newId(), kind: "doctor_review", reason: "Follow-up from the discharge letter", requestedAt: iso, requestedBy: "doctor",
  status: "scheduled", scheduledFor: date, visitNote: "", planVersion: null,
});

export type IntakeResult = { patientId: string; planVersion: number; tasks: number; family: number; checkIn: string | null; isNew: boolean };

function intakeEvent(p: Patient, iso: string, r: Omit<IntakeResult, "patientId" | "isNew">) {
  const event: ActivityEvent = {
    id: newId(), at: iso, actor: "human", who: "doctor", action: "act_intake_confirmed",
    params: { v: r.planVersion, tasks: r.tasks, family: r.family, visit: r.checkIn ?? "" }, refs: [], groupId: `intake-${iso}`,
  };
  p.activity = [...(p.activity ?? []), event].slice(-200);
}

/** The suggestions the doctor kept, as family tasks anyone in the family can take. */
function letterTasks(intake: Intake, iso: string): FamilyTask[] {
  return (intake.suggestedTasks ?? [])
    .filter((x) => x.selected)
    .map((x) => ({
      id: newId(), templateId: null, title: x.title, detail: x.detail, assigneeId: null, category: x.item ? "equipment" : "admin",
      cost: "free", dueDate: null, status: "open", source: "care_team", createdAt: iso, doneAt: null, doneBy: null,
    }));
}

/** DOK-01 Confirm for a new patient: profile, plan v1 (awaiting physio), readiness, family + tasks, visit. */
export function patientFromIntake(intake: Intake, now: number): { patient: Patient; result: IntakeResult } {
  const iso = new Date(now).toISOString();
  const f = intake.fields;
  const profile = profileFrom(f);
  const reviewDate = v<string>(f, "nextVisitDate") ?? isoDate(new Date(now + 14 * DAY));
  const plan: Plan = {
    version: 1, items: firstPlan(limbsOf(profile)), note: "", painThreshold: 7, reviewDate,
    maxSets: null, maxReps: null, source: "intake", awaitingPhysio: true, updatedAt: iso, updatedBy: "doctor",
  };
  const family: FamilyMember[] = intake.family.map((m) => ({ id: newId(), ...m, lang: intake.lang, phone: null }));
  const hospital = v<string>(f, "hospital");
  const patient: Patient = {
    id: newId(),
    name: String(v(f, "patientName") ?? "New patient"),
    age: Number(v(f, "age") ?? 0),
    story: `From a discharge letter${hospital ? ` (${hospital})` : ""}.`,
    lang: intake.lang,
    profile,
    plan,
    planHistory: [],
    memories: [], diary: [], sessions: [], skinChecks: [], alerts: [],
    checkIns: v<string>(f, "nextVisitDate") ? [visitCheckIn(reviewDate, iso)] : [],
    brief: { text: "", lang: intake.lang, generatedAt: null, editedAt: null },
    goals: [], notes: [], preferences: defaultPreferences(),
    family, familyTasks: [], familyUpdate: null, letters: [], proposals: [], activity: [],
    readiness: emptyReadiness(), readinessLog: [], clearedForFittingAt: null, goalReachedAt: null,
    createdAt: iso,
  };
  patient.familyTasks = [...generateFamilyTasks(patient, now), ...letterTasks(intake, iso)];
  if (intake.explanation) patient.letterExplanation = { ...intake.explanation, hospital: v<string>(f, "hospital"), confirmedAt: iso };
  const result = { patientId: patient.id, planVersion: 1, tasks: patient.familyTasks.length, family: family.length, checkIn: patient.checkIns[0]?.scheduledFor ?? null, isNew: true };
  intakeEvent(patient, iso, result);
  return { patient, result };
}

/** DOK-07 Confirm for a letter the family sent: updates the profile, a new plan version with the visit date, the visit. */
export function applyIntake(p: Patient, intake: Intake, now: number): IntakeResult {
  const iso = new Date(now).toISOString();
  const f = intake.fields;
  p.name = String(v(f, "patientName") ?? p.name);
  p.age = Number(v(f, "age") ?? p.age);
  p.profile = profileFrom(f, p.profile);
  const visit = v<string>(f, "nextVisitDate");
  const plan: Plan = { ...p.plan, version: p.plan.version + 1, reviewDate: visit ?? p.plan.reviewDate, source: "intake", awaitingPhysio: false, updatedAt: iso, updatedBy: "doctor" };
  p.planHistory = [...p.planHistory, p.plan].slice(-20);
  p.plan = plan;
  let checkIn: string | null = null;
  if (visit && !p.checkIns.some((c) => c.status !== "done" && c.scheduledFor === visit)) {
    p.checkIns = [...p.checkIns, visitCheckIn(visit, iso)].slice(-50);
    checkIn = visit;
  }
  const known = new Set(p.family.map((m) => m.name.toLowerCase()));
  const added = intake.family.filter((m) => !known.has(m.name.toLowerCase())).map((m) => ({ id: newId(), ...m, lang: intake.lang, phone: null }));
  p.family = [...p.family, ...added].slice(0, 6);
  const tasks = [...generateFamilyTasks(p, now), ...letterTasks(intake, iso)];
  if (intake.explanation) p.letterExplanation = { ...intake.explanation, hospital: v<string>(f, "hospital"), confirmedAt: iso };
  p.familyTasks = [...p.familyTasks, ...tasks];
  // The doctor has seen the letter: the photo is dropped, only the reviewed fields stay (DAT-10).
  p.letters = p.letters.map((l) => (l.id === intake.letterId ? { ...l, status: "reviewed" as const, image: "" } : l));
  const result = { patientId: p.id, planVersion: plan.version, tasks: tasks.length, family: added.length, checkIn, isNew: false };
  intakeEvent(p, iso, result);
  return result;
}
