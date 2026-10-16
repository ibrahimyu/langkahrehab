import { seedCase } from "#shared/cases";

// Restores one prepared case, so each guided scenario starts the same way.
export default defineEventHandler(async (event) => {
  const { ws, now } = await context(event);
  const id = getRouterParam(event, "id") ?? "";
  const fresh = seedCase(id, now);
  if (!fresh) throw createError({ statusCode: 404, statusMessage: "Patient not found." });
  await updatePatient(ws, id, (p) => Object.assign(p, fresh));
  return { ok: true };
});
