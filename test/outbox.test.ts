import assert from "node:assert/strict";
import { test } from "node:test";
import { Outbox } from "../shared/outbox";

test("a newer message with the same key replaces the waiting one and keeps its place", () => {
  const box = new Outbox();
  let rep = 4;
  box.post("rep", () => `rep ${rep}`);
  box.post("flow", () => "rest is over");
  rep = 6;
  box.post("rep", () => `rep ${rep}`);
  assert.equal(box.size, 2);
  assert.equal(box.next(), "rep 6");
  assert.equal(box.next(), "rest is over");
  assert.equal(box.next(), null);
});

test("messages with nothing left to say are skipped", () => {
  const box = new Outbox();
  box.post("idle", () => null);
  box.post("rep", () => "rep 2");
  assert.equal(box.next(), "rep 2");
  assert.equal(box.size, 0);
});
