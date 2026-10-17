import assert from "node:assert/strict";
import { test } from "node:test";
import { detectRedFlags, SpeechWindow } from "../shared/redflags";

const kind = (t: string) => detectRedFlags(t)?.kind ?? null;

test("danger signs in Indonesian, English and Chinese", () => {
  const cases: [string, string][] = [
    ["Kaki saya berdarah di bagian socket", "wound"],
    ["My leg is bleeding where the socket rubs", "wound"],
    ["腿在流血", "wound"],
    ["lukanya bernanah dan saya demam", "infection"],
    ["I have a fever since yesterday", "infection"],
    ["伤口化脓了", "infection"],
    ["tadi pagi saya jatuh di kamar mandi", "fall"],
    ["I fell in the bathroom", "fall"],
    ["我今天摔倒了", "fall"],
    ["dada saya sakit, nyeri dada", "chest_pain"],
    ["I have chest pain", "chest_pain"],
    ["我胸痛", "chest_pain"],
    ["saya sesak napas", "breathing"],
    ["I can't breathe well", "breathing"],
    ["我喘不过气", "breathing"],
    ["saya mau pingsan", "dizziness"],
    ["sakitnya tidak tertahankan", "severe_pain"],
    ["the pain is unbearable", "severe_pain"],
  ];
  for (const [text, want] of cases) assert.equal(kind(text), want, text);
});

test("distress wins over pain in the same sentence, in three languages", () => {
  assert.equal(kind("Rasanya tidak ada gunanya hidup, sakit sekali"), "distress");
  assert.equal(kind("Saya capek, mending mati saja"), "distress");
  assert.equal(kind("Sometimes I want to die"), "distress");
  assert.equal(kind("我不想活了"), "distress");
});

test("ordinary phrases are not danger signs", () => {
  for (const text of [
    "Saya punya darah tinggi", "tekanan darah saya normal", "cek gula darah tadi pagi", "tagihan jatuh tempo besok", "saya tidak jatuh kok",
    "My blood pressure is fine", "I fell asleep early", "no fever today", "我的血压正常", "我没有摔倒",
    "Latihan hari ini lancar", "That felt easy", "今天感觉不错",
  ])
    assert.equal(kind(text), null, text);
});

test("a phrase split across transcription pieces is still caught", () => {
  const w = new SpeechWindow(10_000);
  assert.equal(kind(w.push("kaki saya ber", 1000)), null);
  assert.equal(kind(w.push("darah", 1500)), "wound");
  // Pieces older than the window drop out.
  const w2 = new SpeechWindow(10_000);
  w2.push("I want to ", 0);
  assert.equal(kind(w2.push("die", 20_000)), null);
});

test("Talk with Langkah: quiet despair and a warm, swollen limb are caught", () => {
  for (const t of ["Lebih baik saya tidak ada.", "It would be better if I wasn't here", "我活不下去了"]) assert.equal(detectRedFlags(t)?.kind, "distress", t);
  assert.equal(detectRedFlags("Kaki saya terasa panas sejak kemarin dan agak bengkak.")?.kind, "infection");
  assert.equal(detectRedFlags("My stump is warm and swollen")?.kind, "infection");
  assert.equal(detectRedFlags("Cuaca panas sekali hari ini"), null);
});
