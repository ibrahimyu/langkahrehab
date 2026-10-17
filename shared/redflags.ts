// SYS-01: safety net for danger signs and distress, independent of the AI model.
// The voice coach is told to call report_concern, but a model can miss it. This plain check runs on
// everything the patient says or types; if it matches and the coach has not stopped the session,
// the app stops it itself. Phrase lists are a first draft. CLINICAL_REVIEW_NEEDED.

import type { Lang } from "./exercises";

export type RedFlagKind = "wound" | "infection" | "fall" | "chest_pain" | "breathing" | "dizziness" | "severe_pain" | "distress";
export type RedFlag = { kind: RedFlagKind; match: string };

// Checked in this order: distress first, so a sentence like "I want to die, it hurts so much" is handled as distress.
const PHRASES: Record<RedFlagKind, string[]> = {
  distress: [
    // Indonesian
    "ingin mati", "mau mati", "pengen mati", "pingin mati", "lebih baik mati", "mending mati", "tidak ada gunanya hidup", "gak ada gunanya hidup",
    "nggak ada gunanya hidup", "tidak ingin hidup", "ga mau hidup", "gak mau hidup lagi", "bunuh diri", "mengakhiri hidup", "menyerah saja", "capek hidup",
    "lebih baik saya tidak ada", "lebih baik aku tidak ada", "lebih baik saya hilang", "lebih baik aku hilang",
    // English
    "want to die", "wanna die", "kill myself", "end my life", "no point living", "no reason to live", "better off dead", "don't want to live", "dont want to live", "suicide", "better if i wasn't here", "better off without me",
    // Chinese
    "不想活", "想死", "活不下去", "不如死了", "活着没意思", "自杀", "结束生命",
  ],
  wound: [
    "berdarah", "keluar darah", "darahnya keluar", "luka terbuka", "lukanya terbuka", "jahitan lepas", "jahitannya lepas",
    "bleeding", "is bleeding", "open wound", "wound opened", "stitches came", "流血", "出血", "伤口裂开",
  ],
  infection: [
    "bernanah", "keluar nanah", "nanah", "demam", "meriang", "bau busuk", "merah menyebar", "panas dan merah",
    "pus", "fever", "smells bad", "spreading redness", "化脓", "流脓", "发烧", "发热",
  ],
  fall: ["jatuh", "terjatuh", "terpeleset", "i fell", "fell down", "had a fall", "摔倒", "跌倒", "摔了一跤"],
  chest_pain: ["nyeri dada", "sakit dada", "dada sakit", "dada terasa berat", "chest pain", "chest hurts", "胸痛", "胸口疼"],
  breathing: ["sesak napas", "sesak nafas", "susah napas", "susah nafas", "tidak bisa napas", "can't breathe", "cant breathe", "short of breath", "呼吸困难", "喘不过气"],
  dizziness: ["pusing sekali", "mau pingsan", "pingsan", "kepala berputar", "very dizzy", "going to faint", "fainted", "passed out", "头很晕", "要晕倒", "晕倒"],
  severe_pain: ["sakit sekali", "sakit banget", "nyeri hebat", "sakitnya tak tertahankan", "tidak tertahankan", "unbearable", "excruciating", "worst pain", "疼得受不了", "剧痛"],
};

// Ordinary phrases that contain a danger word but are not danger signs.
const EXCLUSIONS = [
  "darah tinggi", "tekanan darah", "cek darah", "gula darah", "golongan darah", "donor darah", "jatuh tempo", "jatuh cinta", "jatuh hati",
  "tidak jatuh", "nggak jatuh", "gak jatuh", "belum jatuh", "tidak demam", "nggak demam", "gak demam", "tidak berdarah", "nggak berdarah", "gak berdarah",
  "blood pressure", "blood sugar", "blood test", "fall asleep", "fell asleep", "falling asleep", "didn't fall", "did not fall", "no fever", "not bleeding",
  "血压", "血糖", "验血", "没有摔倒", "没发烧", "不发烧",
];

// Two words that together are a danger sign (warm and swollen limb: infection, or Charcot foot in diabetes).
const COMBOS: { kind: RedFlagKind; words: [string[], string[]] }[] = [
  { kind: "infection", words: [["panas", "hangat", "hot", "warm", "发热", "发烫"], ["bengkak", "swollen", "swelling", "肿"]] },
];

const ORDER: RedFlagKind[] = ["distress", "wound", "infection", "fall", "chest_pain", "breathing", "dizziness", "severe_pain"];

/** Lower case, keep letters/digits/CJK and apostrophes, single spaces. */
export function normalize(text: string) {
  return ` ${text.toLowerCase().replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim()} `;
}

/** The first danger sign in the text, or null. `lang` is unused for now: all phrase lists are checked, since people mix languages. */
export function detectRedFlags(text: string, _lang?: Lang): RedFlag | null {
  let t = normalize(text);
  for (const ex of EXCLUSIONS) t = t.split(normalize(ex).trim()).join(" ");
  for (const kind of ORDER)
    for (const phrase of PHRASES[kind]) {
      const p = normalize(phrase).trim();
      // Latin phrases match on word boundaries; Chinese has no spaces, so a plain substring match.
      const hit = /[㐀-鿿]/.test(p) ? t.includes(p) : t.includes(` ${p} `);
      if (hit) return { kind, match: phrase };
    }
  for (const c of COMBOS) {
    const found = c.words.map((list) => list.find((w) => (/[㐀-鿿]/.test(w) ? t.includes(w) : t.includes(` ${w} `))));
    if (found.every(Boolean)) return { kind: c.kind, match: found.join(" + ") };
  }
  return null;
}

/** Keeps the last few seconds of speech, because live transcription arrives in small pieces. */
export class SpeechWindow {
  private parts: { text: string; at: number }[] = [];
  constructor(private readonly ms = 10_000) {}
  push(text: string, at: number) {
    this.parts.push({ text, at });
    this.parts = this.parts.filter((p) => at - p.at <= this.ms);
    return this.parts.map((p) => p.text).join("");
  }
  clear() {
    this.parts = [];
  }
}
