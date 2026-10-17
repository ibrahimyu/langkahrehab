// DOK-01: discharge letter drafts still waiting for the doctor, newest first.
export default defineEventHandler(async (event) => {
  const { ws } = await context(event);
  assertCan(actorFrom(event), "intake.review");
  const intakes = (await listIntakes(ws)).filter((x) => x.status === "awaiting_doctor").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { intakes };
});
