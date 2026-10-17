import assert from "node:assert/strict";
import { test } from "node:test";
import { correction, holdLines, repLine } from "../shared/cues.ts";

const good = { score: 95, range: 1, hold: 1, pace: 1, weakest: null };
const low = { score: 55, range: 0.7, hold: 1, pace: 1, weakest: "range" as const };

test("good reps get praise, weak reps get the exercise's own correction", () => {
  assert.equal(repLine({ count: 1, form: good }, 10, "bridging", "id", null).text, "1. Bagus.");
  const r = repLine({ count: 2, form: low }, 10, "side-lying-abduction", "id", null);
  assert.equal(r.text, "2. Kakinya naik sedikit lagi.");
  assert.ok(r.corrected);
});

test("the same correction is not repeated on every rep", () => {
  assert.equal(repLine({ count: 3, form: low }, 10, "bridging", "en", 2).corrected, false);
  assert.equal(repLine({ count: 4, form: low }, 10, "bridging", "en", 2).corrected, true);
});

test("near the end and at the target", () => {
  assert.equal(repLine({ count: 9, form: good }, 10, "bridging", "en", null).text, "9. One more.");
  assert.equal(repLine({ count: 10, form: low }, 10, "bridging", "en", null).text, "10. Well done, keep going.");
});

test("hold counting and fallbacks", () => {
  assert.deepEqual(holdLines(3, "en"), ["Hold it.", "1", "2", "3", "And down slowly."]);
  assert.deepEqual(holdLines(0, "en"), []);
  assert.equal(correction("range", "gentle-touch", "en"), "Try to go a little further.");
});
