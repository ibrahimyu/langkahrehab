import assert from "node:assert/strict";
import { test } from "node:test";
import { exerciseVideos, videoFor } from "../shared/videos";

test("every original leg exercise has a how-to video for the levels it is written for", () => {
  // Newer exercises (knee straightening, arm and hand) have no verified clinical video yet (MED-01).
  for (const id of ["bridging", "side-lying-abduction", "prone-hip-extension", "sit-to-stand"])
    for (const level of ["below_knee", "above_knee"] as const) assert.ok(videoFor(id, level), `${id} / ${level}`);
});

test("leg levels map to the two video levels; arm levels have no video", () => {
  assert.equal(videoFor("bridging", "knee")?.youtubeId, "MD5j-NixeOA");
  assert.equal(videoFor("bridging", "ankle")?.youtubeId, "IWfo3Kc5gQY");
  assert.equal(videoFor("arm-raise-forward", "below_elbow"), null);
});

test("the level-specific video wins, and ids look like YouTube ids", () => {
  assert.equal(videoFor("bridging", "above_knee")?.youtubeId, "MD5j-NixeOA");
  assert.equal(videoFor("bridging", "below_knee")?.youtubeId, "IWfo3Kc5gQY");
  for (const v of exerciseVideos) assert.match(v.youtubeId, /^[\w-]{11}$/);
});

test("videoFor uses the exercise site and levels with the patient's limbs", () => {
  const arm = { level: "none" as const, side: "left" as const, limbs: [{ site: "upper" as const, side: "right" as const, level: "below_elbow" as const }] };
  assert.equal(videoFor("bridging", arm), null, "an arm-only patient gets no leg video");
  const legAndArm = { level: "above_knee" as const, side: "left" as const, limbs: [{ site: "upper" as const, side: "right" as const, level: "below_elbow" as const }, { site: "lower" as const, side: "left" as const, level: "hip" as const }] };
  assert.equal(videoFor("bridging", legAndArm)?.youtubeId, "MD5j-NixeOA");
  assert.equal(videoFor("seated-knee-straighten", { site: "lower", side: "left", level: "above_knee" }), null, "no knee, no knee video");
  assert.equal(videoFor("bridging", { level: "none", side: "left" })?.youtubeId, "IWfo3Kc5gQY", "a tester gets the leg video");
  for (const v of exerciseVideos) assert.ok(v.site === "lower" || v.site === "upper");
});
