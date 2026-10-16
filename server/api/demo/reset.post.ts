// Puts the prepared cases back, as they were at the start of the demo.
export default defineEventHandler(async (event) => {
  const workspace = await seed(await workspaceId(event));
  return { workspace };
});
