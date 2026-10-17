import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { withDefaults, type Patient, type Workspace } from "#shared/model";
import type { Intake } from "#shared/intake";

// Storage for workspaces and patients. Firestore in production:
//   workspaces/{workspaceId}               Workspace
//   workspaces/{workspaceId}/patients/{id} Patient
// Local files in .data/ for development without a Google Cloud project.

export function adminApp() {
  return getApps()[0] ?? initializeApp({ projectId: useRuntimeConfig().public.firebase.projectId || undefined });
}

let db: Firestore | undefined;
function firestore() {
  if (!db) {
    db = getFirestore(adminApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

const useFirestore = () => useRuntimeConfig().storage === "firestore";
const local = () => useStorage("data");
const wsDoc = (ws: string) => firestore().collection("workspaces").doc(ws);
const patientsCol = (ws: string) => wsDoc(ws).collection("patients");

export async function getWorkspace(ws: string): Promise<Workspace | null> {
  if (useFirestore()) return ((await wsDoc(ws).get()).data() as Workspace | undefined) ?? null;
  return local().getItem<Workspace>(`ws:${ws}:meta`);
}

export async function setWorkspace(ws: string, w: Workspace) {
  if (useFirestore()) await wsDoc(ws).set(w);
  else await local().setItem(`ws:${ws}:meta`, w);
}

export async function listPatients(ws: string): Promise<Patient[]> {
  if (useFirestore()) return (await patientsCol(ws).get()).docs.map((d) => withDefaults(d.data() as Patient));
  const keys = await local().getKeys(`ws:${ws}:p`);
  return (await Promise.all(keys.map((k) => local().getItem<Patient>(k)))).filter((p): p is Patient => !!p).map(withDefaults);
}

export async function getPatient(ws: string, id: string): Promise<Patient | null> {
  const p = useFirestore() ? ((await patientsCol(ws).doc(id).get()).data() as Patient | undefined) ?? null : await local().getItem<Patient>(`ws:${ws}:p:${id}`);
  return p ? withDefaults(p) : null;
}

/** Read-modify-write of one patient; a transaction in Firestore, so concurrent saves are not lost. */
export async function updatePatient(ws: string, id: string, change: (p: Patient) => void): Promise<Patient> {
  const missing = () => createError({ statusCode: 404, statusMessage: "Patient not found." });
  if (useFirestore()) {
    const ref = patientsCol(ws).doc(id);
    return firestore().runTransaction(async (tx) => {
      const p = (await tx.get(ref)).data() as Patient | undefined;
      if (!p) throw missing();
      withDefaults(p);
      change(p);
      tx.set(ref, p);
      return p;
    });
  }
  const p = await getPatient(ws, id);
  if (!p) throw missing();
  change(p);
  await local().setItem(`ws:${ws}:p:${id}`, p);
  return p;
}

/** Replaces the workspace and all its patients (demo reset). */
export async function resetWorkspace(ws: string, w: Workspace, patients: Patient[]) {
  if (useFirestore()) {
    const batch = firestore().batch();
    for (const d of (await patientsCol(ws).get()).docs) batch.delete(d.ref);
    batch.set(wsDoc(ws), w);
    for (const p of patients) batch.set(patientsCol(ws).doc(p.id), p);
    await batch.commit();
    return;
  }
  for (const k of await local().getKeys(`ws:${ws}:p`)) await local().removeItem(k);
  await setWorkspace(ws, w);
  for (const p of patients) await local().setItem(`ws:${ws}:p:${p.id}`, p);
}

// ---- Discharge letter intakes (DAT-10): workspaces/{ws}/intakes/{id}, locally ws:{ws}:intake:{id}. Never an image. ----
const intakesCol = (ws: string) => wsDoc(ws).collection("intakes");

export async function listIntakes(ws: string): Promise<Intake[]> {
  if (useFirestore()) return (await intakesCol(ws).get()).docs.map((d) => d.data() as Intake);
  const keys = await local().getKeys(`ws:${ws}:intake`);
  return (await Promise.all(keys.map((k) => local().getItem<Intake>(k)))).filter((x): x is Intake => !!x);
}

export async function getIntake(ws: string, id: string): Promise<Intake | null> {
  if (useFirestore()) return ((await intakesCol(ws).doc(id).get()).data() as Intake | undefined) ?? null;
  return local().getItem<Intake>(`ws:${ws}:intake:${id}`);
}

export async function saveIntake(ws: string, intake: Intake) {
  if (useFirestore()) await intakesCol(ws).doc(intake.id).set(intake);
  else await local().setItem(`ws:${ws}:intake:${intake.id}`, intake);
}

export async function deleteIntake(ws: string, id: string) {
  if (useFirestore()) await intakesCol(ws).doc(id).delete();
  else await local().removeItem(`ws:${ws}:intake:${id}`);
}

/** DOK-01 Confirm: the new patient and the confirmed intake in one write. */
/** Adds a new patient (admin or doctor, without a letter). */
export async function createPatient(ws: string, patient: Patient) {
  if (useFirestore()) return void (await patientsCol(ws).doc(patient.id).set(patient));
  await local().setItem(`ws:${ws}:p:${patient.id}`, patient);
}

export async function createPatientFromIntake(ws: string, patient: Patient, intake: Intake) {
  if (useFirestore()) {
    const batch = firestore().batch();
    batch.set(patientsCol(ws).doc(patient.id), patient);
    batch.set(intakesCol(ws).doc(intake.id), intake);
    await batch.commit();
    return;
  }
  await local().setItem(`ws:${ws}:p:${patient.id}`, patient);
  await saveIntake(ws, intake);
}
