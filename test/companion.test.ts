import assert from "node:assert/strict";
import { test } from "node:test";
import { EVAL_SENTENCES, isLate, parseCompanion, screenReply } from "../shared/companion";
import { detectRedFlags } from "../shared/redflags";

test("every distress sentence in the evaluation set reaches the crisis screen (no model involved)", () => {
  for (const s of EVAL_SENTENCES.filter((x) => x.expect === "crisis")) assert.equal(detectRedFlags(s.text)?.kind, "distress", s.text);
  for (const s of EVAL_SENTENCES.filter((x) => x.expect === "reply")) assert.equal(detectRedFlags(s.text), null, s.text);
});

test("model output: only valid notes and proposals survive", () => {
  const t = parseCompanion({
    reply: "I hear you.",
    notes: [{ kind: "need", quote: "A lighter wheelchair", summary: "Needs lighter wheelchair" }, { kind: "x", quote: "" }],
    proposals: [
      { tool: "set_exercise_time", time: "07:00" },
      { tool: "set_exercise_time", time: "7am" },
      { tool: "change_plan", text: "fewer reps" },
      { tool: "update_contact", phone: "0812-<b>", email: "bad" },
      { tool: "set_goal", text: "Back to sewing", area: "work" },
    ],
  });
  assert.equal(t.notes.length, 1);
  assert.deepEqual(t.proposals.map((p) => p.tool), ["set_exercise_time", "update_contact", "set_goal"]);
  assert.deepEqual(parseCompanion(null), { reply: "", notes: [], proposals: [], card: null });
  assert.equal(parseCompanion({ card: "phantom" }).card, "phantom");
  assert.equal(parseCompanion({ card: "medicine" }).card, null);
});

test("replies that break a hard limit are caught", () => {
  assert.equal(screenReply("You could take 500 mg paracetamol."), "medicine");
  assert.equal(screenReply("Coba minum ibuprofen."), "medicine");
  assert.equal(screenReply("Yes, I'm a real person."), "human");
  assert.equal(screenReply("I'm all you need."), "dependence");
  assert.equal(screenReply("You'll walk by December."), "promise");
  assert.equal(screenReply("Anda mengalami depresi."), "diagnosis");
  assert.equal(screenReply("It makes sense to feel tired. What is one small thing for today?"), null);
});

test("late-night nudge between 23:00 and 05:00", () => {
  assert.equal(isLate(new Date(2026, 9, 17, 23, 30).getTime()), true);
  assert.equal(isLate(new Date(2026, 9, 17, 3).getTime()), true);
  assert.equal(isLate(new Date(2026, 9, 17, 20).getTime()), false);
});
