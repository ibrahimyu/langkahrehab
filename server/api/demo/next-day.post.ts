import { DAY, nowFor } from "#shared/model";
import { addAlerts, daily } from "#shared/rules";

// Moves the demo clock forward one day and runs the daily checks (missed sessions, review due).
export default defineEventHandler(async (event) => {
  const { ws, workspace } = await context(event);
  const next = { ...workspace, offsetDays: workspace.offsetDays + 1 };
  await setWorkspace(ws, next);
  const now = nowFor(next);
  for (const p of await listPatients(ws)) await updatePatient(ws, p.id, (q) => addAlerts(q, daily(q, now)));
  return { workspace: next, now, day: next.offsetDays, date: new Date(now).toISOString() };
});
