import assert from "node:assert/strict";
import { test } from "node:test";
import { exercises, LANGS } from "../shared/exercises.ts";
import { CHAPTERS, tutorSteps } from "../shared/tutor.ts";

test("every exercise has five filled chapters in every language", () => {
  const profile = { level: "below_knee" as const, side: "left" as const };
  for (const e of exercises)
    for (const lang of LANGS) {
      const steps = tutorSteps(e, lang, profile);
      assert.deepEqual(steps.map((s) => s.chapter), [...CHAPTERS], e.id);
      for (const s of steps) {
        assert.ok(s.lines.length > 0, `${e.id} ${lang} ${s.chapter}`);
        for (const l of s.lines) assert.ok(l && !/[{}]/.test(l), `${e.id} ${lang}: ${l}`);
      }
    }
});
