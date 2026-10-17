// The workspace's sign-in accounts (the sign-in screen and the admin read the same list).
export default defineEventHandler(async (event) => {
  const { workspace } = await context(event);
  return { accounts: workspace.accounts ?? [] };
});
