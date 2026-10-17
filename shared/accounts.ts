// People who can sign in. Each workspace starts with these accounts; the admin adds, renames,
// deactivates and assigns them. Every browser gets its own copy of the data (anonymous Firebase user).

import type { Patient, Role } from "./model";

export type Account = {
  id: string;
  role: Role;
  name: string;
  /** The patient this account belongs to (patient and family accounts). */
  patientId: string | null;
  /** A deactivated account no longer appears on the sign-in screen. */
  active: boolean;
};

export const seedAccounts = (): Account[] => [
  { id: "budi", role: "patient", name: "Pak Budi", patientId: "budi", active: true },
  { id: "sri", role: "family", name: "Bu Sri", patientId: "budi", active: true },
  { id: "rina", role: "physio", name: "Rina", patientId: null, active: true },
  { id: "hendra", role: "doctor", name: "dr. Hendra", patientId: null, active: true },
  { id: "dewi", role: "admin", name: "Dewi", patientId: null, active: true },
  { id: "sari", role: "patient", name: "Ibu Sari", patientId: "sari", active: true },
  { id: "liem", role: "patient", name: "Pak Liem", patientId: "liem", active: true },
  { id: "rafi", role: "patient", name: "Mas Rafi", patientId: "rafi", active: true },
  { id: "tester", role: "patient", name: "Tester", patientId: "tester", active: true },
];

/** Where an account lands after signing in. */
export const homeFor = (a: Pick<Account, "role" | "patientId">) =>
  a.role === "patient" ? `/patient/${a.patientId}` : a.role === "family" ? `/family/${a.patientId}` : a.role === "admin" ? "/admin" : "/care";

/** Whether a clinician account looks after this patient (no care team set = any clinician). */
export function looksAfter(accountId: string | null | undefined, role: Role, p: Pick<Patient, "careTeam">): boolean {
  if (role !== "physio" && role !== "doctor") return true;
  const team = p.careTeam;
  const assigned = role === "physio" ? team?.physioId : team?.doctorId;
  return !assigned || !accountId || assigned === accountId;
}
