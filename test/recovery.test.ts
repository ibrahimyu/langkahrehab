import assert from "node:assert/strict";
import { test } from "node:test";
import { RECOVERY_TOPICS, recoveryCards } from "../shared/recovery";

const langs = ["en", "id", "zh"] as const;

test("every recovery card has all three languages and a source", () => {
  assert.deepEqual(recoveryCards.map((c) => c.id), [...RECOVERY_TOPICS]);
  for (const c of recoveryCards) {
    assert.ok(c.source.trim(), `${c.id}: source`);
    assert.ok(c.points.length >= 2, `${c.id}: points`);
    for (const l of [c.title, c.lede, c.call, ...c.points]) for (const lang of langs) assert.ok(l[lang]?.trim(), `${c.id}: ${lang}`);
    for (const s of c.steps) assert.ok(s >= 1 && s <= 5, `${c.id}: step ${s}`);
  }
});

test("recovery cards avoid words patients should not see", () => {
  const banned = /stump|missing leg|amputated|disabled|cacat|failed|gagal|lazy|malas|puntung|—/i;
  for (const c of recoveryCards) for (const l of [c.title, c.lede, c.call, ...c.points]) for (const lang of langs) assert.doesNotMatch(l[lang], banned, `${c.id}: ${lang}`);
});
