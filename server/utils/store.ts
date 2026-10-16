import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { Patient, Workspace } from "#shared/model";

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
  if (useFirestore()) return (await patientsCol(ws).get()).docs.map((d) => d.data() as Patient);
  const keys = await local().getKeys(`ws:${ws}:p`);
  return (await Promise.all(keys.map((k) => local().getItem<Patient>(k)))).filter((p): p is Patient => !!p);
}

export async function getPatient(ws: string, id: string): Promise<Patient | null> {
  if (useFirestore()) return ((await patientsCol(ws).doc(id).get()).data() as Patient | undefined) ?? null;
  return local().getItem<Patient>(`ws:${ws}:p:${id}`);
}

/** Read-modify-write of one patient; a transaction in Firestore, so concurrent saves are not lost. */
export async function updatePatient(ws: string, id: string, change: (p: Patient) => void): Promise<Patient> {
  const missing = () => createError({ statusCode: 404, statusMessage: "Patient not found." });
  if (useFirestore()) {
    const ref = patientsCol(ws).doc(id);
    return firestore().runTransaction(async (tx) => {
      const p = (await tx.get(ref)).data() as Patient | undefined;
      if (!p) throw missing();
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
