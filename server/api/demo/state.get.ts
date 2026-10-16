export default defineEventHandler(async (event) => {
  const { workspace, now } = await context(event);
  return { workspace, now };
});
