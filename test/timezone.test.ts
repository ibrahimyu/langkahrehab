import assert from "node:assert/strict";
import { test } from "node:test";
import { isoDate } from "../shared/model";

test("23:30 WIB is still the same day; 06:59 WIB is not yesterday (SYS-09)", () => {
  assert.equal(isoDate(new Date("2026-10-17T16:30:00Z")), "2026-10-17"); // 23:30 WIB
  assert.equal(isoDate(new Date("2026-10-16T23:59:00Z")), "2026-10-17"); // 06:59 WIB, UTC says the 16th
  assert.equal(isoDate(new Date("2026-10-16T23:59:00Z"), "UTC"), "2026-10-16");
});
