// Two synthetic discharge letters for the demo (DOK-01, MED-04). Fictional patients and hospitals.
// The browser draws the lines onto a canvas and sends that picture to the same reader as a photo,
// so judges do not need to take a picture. `expected` is the answer key and the fallback output
// ("Sample output") when the AI is unavailable.

import type { FieldValue, IntakeField } from "./intake";

export type SampleLetter = { id: "id" | "en"; title: string; lines: string[]; expected: Record<IntakeField, string | number | null>; medications: string[] };

export const SAMPLE_LETTERS: SampleLetter[] = [
  {
    id: "id",
    title: "Resume Medis Pulang · RS Harapan Sejahtera",
    lines: [
      "SAMPLE · fictional patient",
      "RS HARAPAN SEJAHTERA (fiktif)",
      "RESUME MEDIS PASIEN PULANG",
      "",
      "Nama pasien : Ibu Ratna Wulandari",
      "Umur        : 52 tahun     Jenis kelamin : Perempuan",
      "Tgl masuk   : 28-09-2026   Tgl keluar : 07-10-2026",
      "",
      "Diagnosis   : Ulkus diabetikum pedis dekstra",
      "Tindakan    : Amputasi transtibial (bawah lutut) kanan",
      "Tgl operasi : 30-09-2026",
      "Penyakit penyerta : Diabetes melitus tipe 2, hipertensi",
      "",
      "Anjuran     : Belum boleh menumpu pada kaki kanan.",
      "              Luka dijaga kering. Periksa kaki kiri setiap hari.",
      "Obat pulang : Metformin 500 mg 2x1; Amlodipin 5 mg 1x1",
      "Kontrol     : Poli Rehabilitasi Medik, 24-10-2026",
      "",
      "dr. Contoh, Sp.KFR (fiktif)",
    ],
    expected: {
      patientName: "Ibu Ratna Wulandari", age: 52, sex: "female", amputationSide: "right", amputationLevel: "below_knee", cause: "diabetes",
      surgeryDate: "2026-09-30", comorbidities: "Diabetes melitus tipe 2, hipertensi",
      restrictions: "Belum boleh menumpu pada kaki kanan. Luka dijaga kering. Periksa kaki kiri setiap hari.",
      nextVisitDate: "2026-10-24", hospital: "RS Harapan Sejahtera",
    },
    medications: ["Metformin 500 mg 2x1", "Amlodipin 5 mg 1x1"],
  },
  {
    id: "en",
    title: "Discharge summary · Riverside General Hospital",
    lines: [
      "SAMPLE · fictional patient",
      "RIVERSIDE GENERAL HOSPITAL (fictional)",
      "DISCHARGE SUMMARY",
      "",
      "Patient : Mr Arif Hidayat",
      "Age     : 67        Sex : Male",
      "Admitted: 22 Sep 2026   Discharged: 06 Oct 2026",
      "",
      "Diagnosis : Critical limb ischaemia, left leg",
      "Procedure : Left above-knee (transfemoral) amputation",
      "Date of surgery : 25 Sep 2026",
      "Other conditions : Peripheral arterial disease, COPD",
      "",
      "Advice : No weight bearing on the left side.",
      "         Keep the hip straight when lying down.",
      "Medication on discharge : Aspirin 80 mg once daily;",
      "         Paracetamol 500 mg when needed",
      "Follow-up : Rehabilitation clinic, 21 Oct 2026",
      "",
      "Dr Example, Rehabilitation Medicine (fictional)",
    ],
    expected: {
      patientName: "Mr Arif Hidayat", age: 67, sex: "male", amputationSide: "left", amputationLevel: "above_knee", cause: "vascular",
      surgeryDate: "2026-09-25", comorbidities: "Peripheral arterial disease, COPD",
      restrictions: "No weight bearing on the left side. Keep the hip straight when lying down.",
      nextVisitDate: "2026-10-21", hospital: "Riverside General Hospital",
    },
    medications: ["Aspirin 80 mg once daily", "Paracetamol 500 mg when needed"],
  },
];

export const sampleLetter = (id: unknown) => SAMPLE_LETTERS.find((s) => s.id === id) ?? null;

/** The stored answer as intake fields, used when the AI cannot read the sample. */
export function sampleFields(s: SampleLetter): Record<IntakeField, FieldValue> {
  return Object.fromEntries(Object.entries(s.expected).map(([k, value]) => [k, { value, confidence: value === null ? 0 : 0.9, edited: false }])) as Record<IntakeField, FieldValue>;
}
