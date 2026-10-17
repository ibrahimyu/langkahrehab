import { SOURCES, pick, sanitizeMemory, type Memory } from "#shared/model";

// Replaces the memory list after edits or deletions. A changed memory records who changed it (FIS-05).
export default defineEventHandler(async (event) => {
  const { ws, id, iso } = await patientContext(event);
  const actor = actorFrom(event);
  assertCan(actor, "memory.edit");
  const body = await readBody(event);
  const p = await updatePatient(ws, id, (p) => {
    const before = new Map(p.memories.map((m) => [m.id, m]));
    p.memories = (Array.isArray(body) ? body : [])
      .map((m: any) => sanitizeMemory(m, pick(m?.source, SOURCES, "care_team"), iso))
      .filter((m): m is Memory => !!m)
      .map((m) => {
        const prev = before.get(m.id);
        if (!prev) return m;
        const changed = prev.text !== m.text || prev.kind !== m.kind;
        return {
          ...m,
          source: prev.source,
          createdAt: prev.createdAt,
          editedBy: changed ? (actor.role === "doctor" ? "doctor" : "physio") : prev.editedBy ?? null,
          editedAt: changed ? iso : prev.editedAt ?? null,
        };
      })
      .slice(-50);
  });
  return p.memories;
});
