import { looksAfter } from "#shared/accounts";
import { pickLang, type CareRole } from "#shared/model";

// AI-06 morning triage (server/utils/triage.ts): the rules pick who is listed, the AI words the reason.
export default defineEventHandler(async (event) => {
  const actor = actorFrom(event);
  assertCan(actor, "triage.view");
  const lang = pickLang(getQuery(event).lang);
  const fresh = getQuery(event).refresh === "1";
  const { ws, workspace, now } = await context(event);
  const patients = (await listPatients(ws)).filter((p) => looksAfter(actor.accountId, actor.role, p));
  return buildTriage(event, ws, workspace, now, actor.role as CareRole, lang, patients, fresh);
});
