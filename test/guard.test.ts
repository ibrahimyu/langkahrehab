import assert from "node:assert/strict";
import { test } from "node:test";
import { hitBucket } from "../server/utils/guard";

test("rate limit window: allows max hits, then blocks, then resets", () => {
  const store = new Map();
  for (let i = 0; i < 3; i++) assert.equal(hitBucket(store, "ip-talk:1.2.3.4", 3, 1000, 100), true);
  assert.equal(hitBucket(store, "ip-talk:1.2.3.4", 3, 1000, 200), false);
  assert.equal(hitBucket(store, "ip-talk:5.6.7.8", 3, 1000, 200), true);
  assert.equal(hitBucket(store, "ip-talk:1.2.3.4", 3, 1000, 1200), true);
});
