import assert from "node:assert/strict";
import { test } from "node:test";
import { LANGS, exerciseById, exercises, fitsLimbs, howTo, misfit } from "../shared/exercises";
import { legacyFields, limbName, limbsOf, sanitizeLimbs, type Limb } from "../shared/limbs";
import { describeProfile, sanitizeProfile } from "../shared/model";
import { profileText } from "../shared/i18n";

const arm: Limb = { site: "upper", side: "right", level: "below_elbow" };
const ak: Limb = { site: "lower", side: "left", level: "above_knee" };

test("sanitizeLimbs keeps valid limbs, one per site and side, at most four", () => {
  const out = sanitizeLimbs([arm, { ...arm, level: "elbow" }, { site: "upper", side: "left", level: "below_knee" }, ak, { site: "x" }, "no"]);
  assert.deepEqual(out, [arm, ak]);
  assert.deepEqual(sanitizeLimbs("nope"), []);
});

test("old profiles become one leg; legacy level/side come from the first leg", () => {
  const old = sanitizeProfile({ level: "above_knee", side: "right", stage: "prosthetic" });
  assert.deepEqual(old.limbs, [{ site: "lower", side: "right", level: "above_knee" }]);
  assert.equal(old.level, "above_knee");
  assert.deepEqual(legacyFields([{ site: "lower", side: "left", level: "knee" }]), { level: "above_knee", side: "left" });
  assert.deepEqual(legacyFields([{ site: "lower", side: "left", level: "ankle" }]), { level: "below_knee", side: "left" });
  const armOnly = sanitizeProfile({ limbs: [arm] });
  assert.equal(armOnly.level, "none");
  assert.equal(armOnly.side, "right");
  assert.deepEqual(limbsOf(armOnly), [arm]);
  assert.deepEqual(limbsOf({ level: "none", side: "left" }), []);
});

test("texts come from the limbs", () => {
  const p = sanitizeProfile({ limbs: [arm], stage: "pre_prosthetic", cause: "injury" });
  assert.match(describeProfile(p), /^Below-elbow amputation, right arm; does not have a prosthesis yet/);
  assert.equal(profileText("id", p), "Bawah siku, lengan kanan · belum memakai tangan palsu · cedera");
  assert.equal(limbName("en", { site: "lower", side: "left", level: "toe" }), "left foot");
  assert.equal(limbName("zh", arm), "右手臂");
});

test("exercises fit the limbs they are written for", () => {
  const knee = exerciseById("seated-knee-straighten")!;
  assert.equal(misfit(knee, [ak]), "needs_knee");
  assert.equal(misfit(knee, [{ ...ak, level: "below_knee" }]), null);
  assert.equal(misfit(exerciseById("elbow-bend")!, [{ ...arm, level: "above_elbow" }]), "needs_elbow");
  assert.equal(misfit(exerciseById("bridging")!, [arm]), "other_limb");
  assert.ok(fitsLimbs(exerciseById("gentle-touch")!, [arm]));
  // A tester gets the leg exercises only.
  assert.ok(exercises.filter((e) => fitsLimbs(e, [])).every((e) => e.site !== "upper"));
});

test("instructions name the patient's own limb and never label the body", () => {
  const p = sanitizeProfile({ limbs: [arm] });
  assert.match(howTo(exerciseById("arm-raise-forward")!, "en", p), /Lift your right arm forward/);
  assert.match(howTo(exerciseById("bridging")!, "id", sanitizeProfile({ level: "below_knee", side: "left" })), /Taruh kaki kiri Anda/);
  for (const e of exercises)
    for (const lang of LANGS) {
      const text = howTo(e, lang, p);
      assert.doesNotMatch(text, /\{|amputat|diamputasi|截肢|stump|puntung/i, `${e.id} / ${lang}`);
    }
});

test("coach, brief and skin prompts name the right body part for every site (PAS-20)", async () => {
  const { buildInstruction, amputatedLimbs } = await import("../shared/coach");
  const { seedCase } = await import("../shared/cases");
  const rafi = seedCase("rafi", Date.now())!;
  const text = buildInstruction(rafi, { mode: "coach", askDiary: true }, "");
  assert.match(text, /right arm/);
  assert.doesNotMatch(text, /(left|right|amputated) leg|part of the leg/);
  assert.equal(amputatedLimbs({ level: "none", side: "left", limbs: [arm, ak] }), "right arm or left leg");
  assert.equal(amputatedLimbs({ level: "none", side: "left" }), "limb");
});
