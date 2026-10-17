// A patient added by the admin or a doctor without a discharge letter: profile from the form,
// a first plan that fits every amputated limb (waiting for the physio), family, and accounts.

import type { Account } from "./accounts";
import { exercises, fitsLimbs, type Lang } from "./exercises";
import { generateFamilyTasks } from "./family";
import { legacyFields, sanitizeLimbs, type Limb } from "./limbs";
import {
  CAUSES,
  DAY,
  FAMILY_MAX,
  FAMILY_RELATIONS,
  defaultPreferences,
  emptyReadiness,
  isoDate,
  newId,
  pick,
  pickLang,
  str,
  type FamilyMember,
  type Patient,
  type PlanItem,
} from "./model";

export type NewPatientInput = {
  name: string;
  age: number;
  lang: Lang;
  limbs: Limb[];
  cause: Patient["profile"]["cause"];
  surgeryDate: string | null;
  restrictions: string;
  physioId: string | null;
  doctorId: string | null;
  family: Pick<FamilyMember, "name" | "relation" | "livesWithPatient" | "phone">[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function sanitizeNewPatient(b: any): NewPatientInput | string {
  const name = str(b?.name, 60);
  const age = Math.round(Number(b?.age));
  if (!name) return "Write the patient's name.";
  if (!Number.isFinite(age) || age < 1 || age > 120) return "Write an age from 1 to 120.";
  const limbs = sanitizeLimbs(b?.limbs);
  if (!limbs.length) return "Add at least one amputation.";
  const family = (Array.isArray(b?.family) ? b.family : [])
    .map((m: any) => ({ name: str(m?.name, 40), relation: pick(m?.relation, FAMILY_RELATIONS, "other"), livesWithPatient: !!m?.livesWithPatient, phone: str(m?.phone, 30) || null }))
    .filter((m: { name: string }) => m.name)
    .slice(0, FAMILY_MAX);
  return {
    name,
    age,
    lang: pickLang(b?.lang),
    limbs,
    cause: pick(b?.cause, CAUSES, "unknown"),
    surgeryDate: typeof b?.surgeryDate === "string" && DATE.test(b.surgeryDate) ? b.surgeryDate : null,
    restrictions: str(b?.restrictions, 300),
    physioId: typeof b?.physioId === "string" ? b.physioId : null,
    doctorId: typeof b?.doctorId === "string" ? b.doctorId : null,
    family,
  };
}

/** Up to three starting exercises that fit every amputated limb, at their default dose. */
export function firstPlan(limbs: Limb[]): PlanItem[] {
  return exercises
    .filter((e) => e.id !== "gentle-touch" && fitsLimbs(e, limbs))
    .slice(0, 3)
    .map((e) => ({ exerciseId: e.id, sets: e.sets, reps: e.reps }));
}

export function newPatient(input: NewPatientInput, now: number): { patient: Patient; accounts: Account[] } {
  const iso = new Date(now).toISOString();
  const legacy = legacyFields(input.limbs);
  const family: FamilyMember[] = input.family.map((m) => ({ id: newId(), ...m, lang: input.lang }));
  const patient: Patient = {
    id: newId(),
    name: input.name,
    age: input.age,
    story: "",
    lang: input.lang,
    profile: { limbs: input.limbs, ...legacy, stage: "pre_prosthetic", cause: input.cause, restrictions: input.restrictions, comorbidities: "", surgeryDate: input.surgeryDate },
    plan: {
      version: 1, items: firstPlan(input.limbs), note: "", painThreshold: 7, reviewDate: isoDate(new Date(now + 14 * DAY)),
      maxSets: null, maxReps: null, source: "intake", awaitingPhysio: true, updatedAt: iso, updatedBy: "doctor",
    },
    planHistory: [],
    memories: [], diary: [], sessions: [], skinChecks: [], alerts: [], checkIns: [],
    brief: { text: "", lang: input.lang, generatedAt: null, editedAt: null },
    goals: [], notes: [], preferences: defaultPreferences(),
    family, familyTasks: [], familyUpdate: null, letters: [], proposals: [], activity: [],
    readiness: emptyReadiness(), readinessLog: [], clearedForFittingAt: null, goalReachedAt: null,
    careTeam: { physioId: input.physioId, doctorId: input.doctorId },
    createdAt: iso,
  };
  patient.familyTasks = generateFamilyTasks(patient, now);
  const accounts: Account[] = [
    { id: newId(), role: "patient", name: patient.name, patientId: patient.id, active: true },
    ...family.map((m): Account => ({ id: newId(), role: "family", name: m.name, patientId: patient.id, active: true })),
  ];
  return { patient, accounts };
}
