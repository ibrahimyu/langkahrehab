import { summarize } from "#shared/model";
import { careSignals } from "#shared/triage";

export default defineEventHandler(async (event) => {
  const { ws, now } = await context(event);
  const order = ["budi", "sari", "liem", "rafi", "tester"];
  // Summary plus the triage signals (FIS-01); private notes are not counted.
  const patients = (await listPatients(ws)).map((p) => ({ ...summarize(p), ...careSignals(p, now) }));
  patients.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  return { patients, now };
});
