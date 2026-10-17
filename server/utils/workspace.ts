import type { H3Event } from "h3";
import { getAuth } from "firebase-admin/auth";
import { seedAccounts } from "#shared/accounts";
import { seedCases } from "#shared/cases";
import { isoDate, type Patient, type Workspace } from "#shared/model";

/**
 * Which copy of the data this request belongs to. With Firebase configured, the visitor's anonymous
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

/** Creates the copy with the prepared cases on first use. */
export async function seed(ws: string) {
  const w: Workspace = { createdAt: new Date().toISOString(), accounts: seedAccounts() };
  await resetWorkspace(ws, w, seedCases(Date.now()));
  return w;
}

const cycles = new Map<string, ReturnType<typeof runDailyCycle>>();

/** The request's workspace (seeded if new). The daily navigator cycle runs on the first request of each day. */
export async function context(event: H3Event) {
  const ws = await workspaceId(event);
  let workspace = await getWorkspace(ws);
  // A copy whose clock was moved forward has sessions dated in the future: start it again.
  if (!workspace || workspace.offsetDays) {
    // SYS-02: every new copy writes seed data; limit how many one visitor can create (production store only).
    if (useRuntimeConfig().storage === "firestore") rateLimit(event, "", "ws-new", 10, 3_600_000);
    workspace = await seed(ws);
  }
  if (!workspace.accounts) {
    workspace = { ...workspace, accounts: seedAccounts() };
    await setWorkspace(ws, workspace);
  }
  const now = Date.now();
  if (workspace.lastDailyCycle !== isoDate(new Date(now))) {
    // Parallel first requests of the day share one run.
    let run = cycles.get(ws);
    if (!run) {
      run = runDailyCycle(event, ws, workspace, now).finally(() => cycles.delete(ws));
      cycles.set(ws, run);
    }
    const cycle = await run;
    workspace = { ...workspace, lastDailyCycle: cycle.date, triage: {} };
  }
  return { ws, workspace, now };
}

/** Context plus the patient named in the route. */
export async function patientContext(event: H3Event) {
  const c = await context(event);
  const id = getRouterParam(event, "id") ?? "";
  const patient: Patient | null = await getPatient(c.ws, id);
  if (!patient) throw createError({ statusCode: 404, statusMessage: "Patient not found." });
  return { ...c, id, patient, iso: new Date(c.now).toISOString() };
}
