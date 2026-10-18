import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSpokenScore, saysNone } from "../shared/answers";

test("a pain number the patient never said is refused", () => {
  assert.match(checkSpokenScore("", 3)!, /not answered/);
  assert.match(checkSpokenScore("   ", 0)!, /not answered/);
  assert.match(checkSpokenScore("saya siap", 3)!, /did not say a number/);
  assert.match(checkSpokenScore("about five", 3)!, /said 5, not 3/);
});

test("a pain number the patient said is accepted, in any of the app's languages", () => {
  assert.equal(checkSpokenScore("maybe three", 3), null);
  assert.equal(checkSpokenScore(" mungkin tiga ", 3), null);
  assert.equal(checkSpokenScore("8 out of 10", 8), null);
  assert.equal(checkSpokenScore("三", 3), null);
  assert.equal(checkSpokenScore("sepuluh", 10), null);
});

test("no pain counts as 0 only when said plainly", () => {
  assert.equal(checkSpokenScore("tidak sakit", 0), null);
  assert.equal(checkSpokenScore("No.", 0), null);
  assert.equal(checkSpokenScore("it doesn't hurt", 0), null);
  assert.equal(checkSpokenScore("不疼", 0), null);
  assert.equal(saysNone("not too bad"), false);
  assert.match(checkSpokenScore("not too bad", 0)!, /did not say a number/);
});
