import { pick, sanitizeMemory } from "#shared/model";

// Adds one memory (from the coach's save_memory, the patient, or the care team).
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const body = await readBody(event);
  const memory = sanitizeMemory({ ...body, id: undefined, createdAt: undefined }, pick(body?.source, ["coach", "patient", "care_team"] as const, "patient"), iso);
  if (!memory) throw bad("Memory text is empty.");
  const p = await updatePatient(ws, id, (p) => {
    p.memories = [...p.memories, memory].slice(-50);
  });
  return p.memories;
});
