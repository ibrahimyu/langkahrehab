import assert from "node:assert/strict";
import { test } from "node:test";
import { can, notesFor } from "../shared/permissions";
import { planDiff } from "../shared/planDiff";
import type { Note } from "../shared/model";

const note = (id: string, priv: boolean): Note => ({
  id, at: "2026-10-17T08:00:00Z", kind: "worry", quote: "q", summary: "s", urgency: "normal", source: "typed", via: "text",
  private: priv, readAt: null, readBy: null, discussAtVisit: false, reply: "",
});

test("private notes are for the patient only", () => {
  const notes = [note("a", false), note("b", true)];
  assert.deepEqual(notesFor("patient", notes).map((n) => n.id), ["a", "b"]);
  for (const r of ["physio", "doctor", "family"] as const) assert.deepEqual(notesFor(r, notes).map((n) => n.id), ["a"]);
});

test("the care team reviews notes; only the patient hides them", () => {
  for (const r of ["physio", "doctor"] as const) {
    assert.equal(can(r, "note.review"), true);
    assert.equal(can(r, "note.manage"), false);
  }
  assert.equal(can("family", "note.review"), false);
});

test("planDiff lists added, removed, dose and limit changes", () => {
  const before = { items: [{ exerciseId: "bridging", sets: 2, reps: 10 }, { exerciseId: "x", sets: 1, reps: 5 }], note: "", painThreshold: 6, reviewDate: "2026-11-01" };
  const after = { items: [{ exerciseId: "bridging", sets: 2, reps: 8 }, { exerciseId: "y", sets: 3, reps: 12 }], note: "Slow", painThreshold: 5, reviewDate: "2026-11-01", maxReps: 12 };
  const d = planDiff(before, after);
  assert.deepEqual(d.find((c) => c.kind === "dose"), { kind: "dose", exerciseId: "bridging", field: "reps", from: 10, to: 8 });
  assert.ok(d.some((c) => c.kind === "added" && c.exerciseId === "y"));
  assert.ok(d.some((c) => c.kind === "removed" && c.exerciseId === "x"));
  assert.ok(d.some((c) => c.kind === "limit" && c.field === "painThreshold" && c.to === "5"));
  assert.ok(d.some((c) => c.kind === "limit" && c.field === "maxReps" && c.from === "–" && c.to === "12"));
  assert.ok(d.some((c) => c.kind === "note"));
  assert.equal(planDiff(before, before).length, 0);
});

import { triage, type CareSummary } from "../shared/triage";

const row = (id: string, extra: Partial<CareSummary> = {}): CareSummary => ({
  id, name: id, age: 60, story: "", lang: "id", profile: { level: "below_knee", side: "left", stage: "pre_prosthetic", cause: "diabetes", restrictions: "" },
  openAlerts: 0, topSeverity: null, lastSessionAt: "2026-10-17T07:00:00Z", reviewDate: "2026-12-01",
  alerts: [], unreadNotes: 0, urgentNotes: 0, goalsAwaitingOk: 0, checkInRequested: false, activeDays7: 5, journeyStage: 2, ...extra,
});

test("triage: high alert first, then what waits for the physio; calm patients are left out", () => {
  const now = Date.parse("2026-10-17T10:00:00Z");
  const rows = [
    row("sari", { goalsAwaitingOk: 2 }),
    row("calm"),
    row("budi", { alerts: [{ severity: "high", kind: "pain_high", for: ["physio", "doctor"] }] }),
    row("liem", { lastSessionAt: "2026-10-12T07:00:00Z" }),
  ];
  const physio = triage(rows, "physio", now);
  assert.deepEqual(physio.map((t) => t.patient.id), ["budi", "sari", "liem"]);
  assert.equal(physio[1]!.tab, "goals");
  assert.equal(physio[2]!.reason.kind, "missed");
  // The doctor does not give goal OKs, and only sees alerts meant for the doctor.
  const doctor = triage([...rows, row("x", { alerts: [{ severity: "low", kind: "missed_sessions", for: ["physio"] }] })], "doctor", now);
  assert.deepEqual(doctor.map((t) => t.patient.id), ["budi", "liem"]);
});
