import { patientStats } from "#shared/stats";

export default defineEventHandler(async (event) => {
  const { patient, now } = await patientContext(event);
  return { patient, stats: patientStats(patient), now };
});
