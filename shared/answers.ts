// A pain number the coach records must be one the patient actually said. Gemini Live sometimes
// asks "how is your pain, 0 to 10?" and calls record_pain in the same breath with a number of its
// own; the app checks the call against the patient's recent words and refuses a guess.

import { parseNumbers } from "./numbers";

const clean = (s: string) => s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** "No pain" said without a number: "no", "tidak sakit", "nggak ada", "不痛". */
const NONE = [
  /\bno pain\b/, /\bnot (?:any )?pain\b/, /\b(?:doesn t|does not|didn t|did not|not) hurt\b/, /\bnothing\b/, /\bnone\b/,
  /\b(?:tidak|nggak|enggak|ngga|gak|ga|tak) (?:sakit|ada|terasa|pernah)\b/, /\bbelum (?:pernah|ada)\b/,
  /不痛|不疼|没有|沒有|没痛|没疼/,
];
const BARE_NO = /^(?:no|nope|tidak|nggak|enggak|ngga|gak|ga|belum|不|没|沒)$/;

export function saysNone(text: string): boolean {
  const t = clean(text);
  return BARE_NO.test(t) || NONE.some((r) => r.test(t));
}

/** Why a 0–10 score the coach wants to record does not match what the patient said, or null if it does. */
export function checkSpokenScore(heard: string, score: number): string | null {
  if (!clean(heard)) return "The patient has not answered yet. Stop talking and wait for their answer. Never guess a number.";
  const said = parseNumbers(heard).filter((n) => n >= 0 && n <= 10);
  if (said.includes(score)) return null;
  if (said.length) return `The patient said ${[...new Set(said)].join(" or ")}, not ${score}. Record the number they said, or ask again if you are not sure.`;
  if (score === 0 && saysNone(heard)) return null;
  return "The patient did not say a number. Ask once more for a number from 0 to 10, then stop and wait for the answer.";
}
