import type { H3Event } from "h3";
import { getAuth } from "firebase-admin/auth";
import { seedCases } from "#shared/cases";
import { nowFor, type Patient, type Workspace } from "#shared/model";

/**
 * Which demo copy this request belongs to. With Firebase configured, the visitor's anonymous
 * Firebase user id (verified ID token); without it, a random id the browser keeps (local development).
 */
export async function workspaceId(event: H3Event): Promise<string> {
  if (useRuntimeConfig().public.firebase.apiKey) {
    const token = getHeader(event, "authorization")?.replace(/^Bearer /, "");
    if (!token) throw createError({ statusCode: 401, statusMessage: "Sign-in required." });
    try {
      return (await getAuth(adminApp()).verifyIdToken(token)).uid;
    } catch {
      throw createError({ statusCode: 401, statusMessage: "Sign-in expired. Reload the page." });
    }
  }
  const id = getHeader(event, "x-workspace") ?? "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw createError({ statusCode: 401, statusMessage: "Missing workspace id." });
  return `local-${id}`;
}

/** Creates the demo copy with the prepared cases on first use. */
export async function seed(ws: string) {
  const w: Workspace = { createdAt: new Date().toISOString(), offsetDays: 0 };
  await resetWorkspace(ws, w, seedCases(Date.now()));
  return w;
}

/** The request's workspace (seeded if new) and the demo clock. */
export async function context(event: H3Event) {
  const ws = await workspaceId(event);
  const workspace = (await getWorkspace(ws)) ?? (await seed(ws));
  return { ws, workspace, now: nowFor(workspace) };
}

/** Context plus the patient named in the route. */
export async function patientContext(event: H3Event) {
  const c = await context(event);
  const id = getRouterParam(event, "id") ?? "";
  const patient: Patient | null = await getPatient(c.ws, id);
  if (!patient) throw createError({ statusCode: 404, statusMessage: "Patient not found." });
  return { ...c, id, patient, iso: new Date(c.now).toISOString() };
}
