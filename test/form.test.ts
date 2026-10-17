import assert from "node:assert/strict";
import { test } from "node:test";
import { formBand, mainTip, scoreRep, sessionForm } from "../shared/form.ts";

const bridge = { up: 160, down: 145, holdMs: 3000 };

test("a full, held, controlled rep scores high", () => {
  const r = scoreRep({ peak: 168, heldMs: 3200, durationMs: 5200 }, bridge);
  assert.ok(r.score >= 95, String(r.score));
  assert.equal(r.weakest, null);
});

test("a rushed rep without the hold points to the hold", () => {
  const r = scoreRep({ peak: 161, heldMs: 400, durationMs: 1200 }, bridge);
  assert.ok(r.score < 60, String(r.score));
  assert.equal(r.weakest, "hold");
});

test("movements without a hold are scored on range and pace", () => {
  const r = scoreRep({ peak: 175, heldMs: 0, durationMs: 800 }, { up: 155, down: 115, holdMs: 0 });
  assert.equal(r.hold, 1);
  assert.equal(r.weakest, "pace");
});

test("a falling signal (lower is better) is scored the same way", () => {
  const r = scoreRep({ peak: 20, heldMs: 2000, durationMs: 4000 }, { up: 30, down: 50, holdMs: 2000 });
  assert.equal(r.range, 1);
});

test("bands, tips and session score", () => {
  assert.equal(formBand(90), "great");
  assert.equal(formBand(72), "good");
  assert.equal(formBand(55), "steady");
  assert.equal(formBand(30), "slow_down");
  const weak = { score: 50, range: 1, hold: 0.2, pace: 1, weakest: "hold" as const };
  const ok = { score: 95, range: 1, hold: 1, pace: 1, weakest: null };
  assert.equal(mainTip([weak, weak, ok]), "hold");
  assert.equal(mainTip([weak, ok, ok, ok, ok]), null);
  assert.equal(sessionForm([{ form: [80, null] }, { form: [90] }, {}]), 85);
  assert.equal(sessionForm([{}]), null);
});
