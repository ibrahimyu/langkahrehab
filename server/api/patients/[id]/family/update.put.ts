import { pickLang, str } from "#shared/model";
import { familyView } from "#shared/family";

// KEL-04: the physio rewrites this week's family news before or after it is shared (FIS-09).
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso, patient } = await patientContext(event);
  assertCan(actorFrom(event), "familyUpdate.edit");
  const b = (await readBody(event)) ?? {};
  const text = str(b.text, 600);
  if (!text) throw bad("Write the update.");
  const p = await updatePatient(ws, id, (p) => {
    p.familyUpdate = { text, lang: pickLang(b.lang ?? patient.lang), generatedAt: iso, by: "care_team" };
  });
  return familyView(p, now);
});
