import assert from "node:assert/strict";
import { test } from "node:test";
import { isEcho } from "../shared/echo";

test("the coach's own words picked up by the mic are echo; patient answers are kept", () => {
  const coach = "Bagus sekali, Pak Budi. Sekarang angkat pinggul pelan-pelan, tahan lima detik.";
  assert.equal(isEcho("angkat pinggul pelan pelan tahan", coach), true);
  assert.equal(isEcho("tiga", coach), false);
  assert.equal(isEcho("ya saya siap", coach), false);
  assert.equal(isEcho("kaki saya sakit sekali dan berdarah", coach), false);
  assert.equal(isEcho("anything at all", ""), false);
});
