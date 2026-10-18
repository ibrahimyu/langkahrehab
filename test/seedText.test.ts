import assert from "node:assert/strict";
import { test } from "node:test";
import { seedCases } from "../shared/cases";
import { localizeSeed, seedText } from "../shared/seedText";

const NOW = new Date(2026, 9, 17, 12).getTime();
const NOT_EN = /[一-鿿]|\b(yang|dengan|tidak|saya|sudah|bisa|jalan|ingin|setiap|kaki|di|ke)\b/i;

test("every seed sentence a patient, family or clinician reads is shown in English", () => {
  for (const p of localizeSeed(seedCases(NOW), "en")) {
    const texts = [
      p.plan.note, p.profile.restrictions,
      ...p.memories.map((m) => m.text), ...p.diary.map((d) => d.note),
      ...p.goals.flatMap((g) => [g.text, ...g.targets.map((t) => t.text)]),
      ...p.notes.map((n) => n.quote),
      ...p.skinChecks.map((s) => s.result.patientMessage),
    ];
    for (const t of texts) assert.doesNotMatch(t ?? "", NOT_EN, `${p.id}: "${t}"`);
  }
});

test("seed sentences switch between languages and leave typed text alone", () => {
  const en = seedText("Periksa kaki kanan setiap hari.", "en");
  assert.equal(en, "Check the right foot every day.");
  assert.equal(seedText(en, "id"), "Periksa kaki kanan setiap hari.");
  assert.equal(seedText("Saya mau tanya soal obat.", "en"), "Saya mau tanya soal obat.");
  assert.deepEqual(localizeSeed({ n: 3, at: null, list: ["malam hari"] }, "zh"), { n: 3, at: null, list: ["晚上"] });
});
