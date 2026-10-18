import { timingSafeEqual } from "node:crypto";

// SYS-03: the daily navigator cycle for every workspace, called once a day by Cloud Scheduler with the
// header `x-cron-secret: $NUXT_CRON_SECRET`. Not a person, so no role: the secret is the permission.
// Idempotent: a workspace that already ran today is skipped. `?ws=<id>` runs one workspace only.
export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig().cronSecret;
  if (!secret) throw createError({ statusCode: 503, statusMessage: "Cron is not configured (NUXT_CRON_SECRET)." });
  const given = getHeader(event, "x-cron-secret") ?? "";
  const ok = given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) throw createError({ statusCode: 401, statusMessage: "Wrong cron secret." });
  const only = getQuery(event).ws;
  const ids = typeof only === "string" && only ? [only] : await listWorkspaces();
  const now = Date.now();
  const results = [];
  for (const ws of ids) {
    const workspace = await getWorkspace(ws);
    // Copies from an older version (moved clock) are made again on their next visit, not here.
    if (!workspace || workspace.offsetDays) continue;
    const r = await ensureDailyCycle(event, ws, workspace, now, true);
    results.push({ ws, ran: r.ran, date: r.date, alerts: r.alerts, proposals: r.proposals, briefs: r.briefs, tasks: r.tasks });
  }
  return { at: new Date(now).toISOString(), workspaces: results.length, results };
});
