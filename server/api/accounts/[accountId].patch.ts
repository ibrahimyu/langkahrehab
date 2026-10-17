import { str } from "#shared/model";

// Admin: rename an account, or deactivate it (it leaves the sign-in screen; Undo turns it back on).
export default defineEventHandler(async (event) => {
  const { ws, workspace } = await context(event);
  const actor = actorFrom(event);
  assertCan(actor, "account.manage");
  const id = getRouterParam(event, "accountId");
  const b = (await readBody(event)) ?? {};
  const accounts = workspace.accounts ?? [];
  const account = accounts.find((a) => a.id === id);
  if (!account) throw createError({ statusCode: 404, statusMessage: "Account not found." });
  if (b.name !== undefined) {
    const name = str(b.name, 60);
    if (!name) throw bad("Write a name.");
    account.name = name;
  }
  if (b.active !== undefined) {
    if (account.id === actor.accountId && !b.active) throw bad("You cannot deactivate your own account.");
    account.active = !!b.active;
  }
  await setWorkspace(ws, { ...workspace, accounts });
  return { accounts, account };
});
