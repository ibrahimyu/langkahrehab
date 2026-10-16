import { SOURCES, pick, sanitizeMemory, type Memory } from "#shared/model";

// Replaces the memory list after edits or deletions.
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const body = await readBody(event);
  const memories = (Array.isArray(body) ? body : [])
    .map((m: any) => sanitizeMemory(m, pick(m?.source, SOURCES, "care_team"), iso))
    .filter((m): m is Memory => !!m)
    .slice(-50);
  const p = await updatePatient(ws, id, (p) => (p.memories = memories));
  return p.memories;
});
