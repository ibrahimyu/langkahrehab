import { test } from "node:test";
import assert from "node:assert/strict";
import { EnergyVad, rms } from "../shared/vad";

test("speech starts after two loud chunks and ends after the hangover", () => {
  const vad = new EnergyVad(0.02, 500);
  assert.equal(vad.push(0.05, 0), null);
  assert.equal(vad.push(0.05, 40), "start");
  assert.equal(vad.push(0.001, 80), null);
  assert.equal(vad.push(0.001, 500), null);
  assert.equal(vad.push(0.001, 540), "end");
});

test("a pause shorter than the hangover keeps the turn open", () => {
  const vad = new EnergyVad(0.02, 3000);
  vad.push(0.05, 0);
  vad.push(0.05, 40);
  assert.equal(vad.push(0.001, 2000), null);
  vad.push(0.05, 2040);
  assert.equal(vad.push(0.001, 4000), null);
  assert.equal(vad.push(0.001, 5040), "end");
});

test("scale raises the threshold while the coach talks", () => {
  const vad = new EnergyVad(0.02, 500);
  vad.scale = 2.5;
  vad.push(0.03, 0);
  assert.equal(vad.push(0.03, 40), null);
});

test("rms of a full-scale square wave is about 1", () => {
  assert.ok(Math.abs(rms(new Int16Array([32767, -32768, 32767, -32768])) - 1) < 0.001);
});
