import { looksAfter } from "#shared/accounts";
import { summarize } from "#shared/model";
import { careSignals } from "#shared/triage";

export default defineEventHandler(async (event) => {
  const { ws, now } = await context(event);
  const order = ["budi", "sari", "liem", "rafi", "tester"];
  // Summary plus the triage signals (FIS-01); private notes are not counted.
  // A physio or doctor sees the patients they look after (and those not assigned to anyone).
  const actor = actorFrom(event);
  const patients = (await listPatients(ws)).filter((p) => looksAfter(actor.accountId, actor.role, p)).map((p) => ({ ...summarize(p), ...careSignals(p, now), careTeam: p.careTeam ?? null }));
  patients.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  return { patients, now };
});
