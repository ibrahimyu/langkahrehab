import type { Account } from "#shared/accounts";
import { ROLES, newId, pick, str } from "#shared/model";

// Admin: a new sign-in account. Patient and family accounts belong to an existing patient.
export default defineEventHandler(async (event) => {
  const { ws, workspace } = await context(event);
  assertCan(actorFrom(event), "account.manage");
  const b = (await readBody(event)) ?? {};
  const role = pick(b.role, ROLES, "physio");
  const name = str(b.name, 60);
  if (!name) throw bad("Write a name.");
  let patientId: string | null = null;
  if (role === "patient" || role === "family") {
    if (!(await getPatient(ws, String(b.patientId ?? "")))) throw bad("Choose the patient this account belongs to.");
    patientId = String(b.patientId);
  }
  const account: Account = { id: typeof b.id === "string" && /^[\w-]{1,64}$/.test(b.id) ? b.id : newId(), role, name, patientId, active: true };
  const accounts = [...(workspace.accounts ?? []).filter((a) => a.id !== account.id), account];
  await setWorkspace(ws, { ...workspace, accounts });
  return { accounts, account };
});
