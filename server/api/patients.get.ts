import { summarize } from "#shared/model";

export default defineEventHandler(async (event) => {
  const { ws, now } = await context(event);
  const order = ["budi", "sari", "liem", "tester"];
  const patients = (await listPatients(ws)).map(summarize);
  patients.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  return { patients, now };
});
