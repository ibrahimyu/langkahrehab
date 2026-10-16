import { test } from "node:test";
import assert from "node:assert/strict";
import { heardCount, parseNumbers } from "../shared/numbers";

test("Indonesian counting", () => {
  assert.deepEqual(parseNumbers("satu, dua, tiga... empat lima"), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseNumbers("sepuluh sebelas dua belas"), [10, 11, 12]);
  assert.deepEqual(parseNumbers("sembilan belas dua puluh dua puluh satu"), [19, 20, 21]);
});

test("English counting and digits", () => {
  assert.deepEqual(parseNumbers("One. Two! three"), [1, 2, 3]);
  assert.deepEqual(parseNumbers("twenty twenty one"), [20, 21]);
  assert.deepEqual(parseNumbers("7, 8, 9, 10"), [7, 8, 9, 10]);
});

test("heardCount takes the highest plausible count", () => {
  assert.equal(heardCount("satu dua tiga ... sudah selesai"), 3);
  assert.equal(heardCount("delapan sembilan sepuluh"), 10);
  assert.equal(heardCount("sudah"), null);
});

test("Chinese counting", () => {
  assert.deepEqual(parseNumbers("一，二，三，四"), [1, 2, 3, 4]);
  assert.deepEqual(parseNumbers("九 十 十一 十二"), [9, 10, 11, 12]);
  assert.deepEqual(parseNumbers("二十，二十一"), [20, 21]);
  assert.equal(heardCount("一二三四五六七八，好了"), 8);
});
