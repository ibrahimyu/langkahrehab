// Demo accounts for the sign-in screen. No passwords: judges and visitors open the app as one
// person in one tap. Every visitor still gets their own copy of the data (anonymous Firebase user).
// Real sign-in (email or Google, invitations per patient) is on the roadmap (docs/product/frd/01, ROL-08).

import type { Role } from "./model";

export type DemoAccount = {
  id: string;
  role: Role;
  name: string;
  /** The patient this account belongs to (patient and family accounts). */
  patientId: string | null;
  /** Shown on the sign-in screen; false while the role's screens are still being built. */
  ready: boolean;
};

export const demoAccounts: DemoAccount[] = [
  { id: "budi", role: "patient", name: "Pak Budi", patientId: "budi", ready: true },
  { id: "sri", role: "family", name: "Bu Sri", patientId: "budi", ready: true },
  { id: "rina", role: "physio", name: "Rina", patientId: null, ready: true },
  { id: "hendra", role: "doctor", name: "dr. Hendra", patientId: null, ready: true },
  // More patients, reachable from "Other demo patients".
  { id: "sari", role: "patient", name: "Ibu Sari", patientId: "sari", ready: true },
  { id: "liem", role: "patient", name: "Pak Liem", patientId: "liem", ready: true },
  { id: "rafi", role: "patient", name: "Mas Rafi", patientId: "rafi", ready: true },
  { id: "tester", role: "patient", name: "Tester", patientId: "tester", ready: true },
];

export const accountById = (id: string) => demoAccounts.find((a) => a.id === id);

/** Where an account lands after signing in. */
export const homeFor = (a: DemoAccount) =>
  a.role === "patient" ? `/patient/${a.patientId}` : a.role === "family" ? `/family/${a.patientId}` : "/care";
