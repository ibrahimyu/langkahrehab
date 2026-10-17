import { nowFor } from "#shared/model";

// Moves the demo clock forward one day and runs the daily navigator cycle (SYS-03): missed sessions,
// review due, mood, progression proposals, and a summary in each patient's activity feed.
export default defineEventHandler(async (event) => {
  const { ws, workspace } = await context(event);
  const next = { ...workspace, offsetDays: workspace.offsetDays + 1 };
  await setWorkspace(ws, next);
  const now = nowFor(next);
  const cycle = await runDailyCycle(event, ws, next, now);
  return { workspace: { ...next, lastDailyCycle: cycle.date }, now, day: next.offsetDays, date: new Date(now).toISOString(), cycle };
});
