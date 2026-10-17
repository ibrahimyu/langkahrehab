import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIcs, calendarDays, calendarEvents, dayKey, dayStart, monthGrid, nextVisit, parseSpokenTime, weekOf } from "../shared/calendar";
import { seedCases } from "../shared/cases";

const NOW = new Date(2026, 9, 17, 12).getTime(); // Sat 17 Oct 2026, local noon
const patient = () => structuredClone(seedCases(NOW)[0]!);

test("weeks start on Monday and months are whole weeks", () => {
  assert.deepEqual(weekOf("2026-10-17"), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  const m = monthGrid("2026-10-17");
  assert.equal(m.length % 7, 0);
  assert.equal(m[0], "2026-09-28");
  assert.ok(m.includes("2026-10-31") && !m.includes("2026-11-09"));
  assert.equal(dayKey(dayStart("2026-03-01")), "2026-03-01");
});

test("exercise days: done, missed (neutral), today and planned", () => {
  const p = patient();
  p.preferences.exerciseDays = [0, 1, 2, 3, 4, 5, 6];
  p.createdAt = new Date(2026, 9, 1).toISOString();
  p.sessions = p.sessions.slice(0, 1);
  p.sessions[0]!.at = new Date(2026, 9, 15, 9).toISOString();
  const days = calendarDays(p, NOW, weekOf("2026-10-17"));
  const state = Object.fromEntries(days.map((d) => [d.date, d.exercise]));
  assert.equal(state["2026-10-15"], "done");
  assert.equal(state["2026-10-14"], "missed");
  assert.equal(state["2026-10-17"], "today");
  assert.equal(state["2026-10-18"], "planned");
  // Not an exercise day: nothing, not "missed".
  p.preferences.exerciseDays = [4];
  assert.equal(calendarDays(p, NOW, ["2026-10-14"])[0]!.exercise, null);
  // Before the patient started: nothing.
  p.preferences.exerciseDays = [0, 1, 2, 3, 4, 5, 6];
  assert.equal(calendarDays(p, NOW, ["2026-09-20"])[0]!.exercise, null);
});

test("visits, plan changes and the next visit", () => {
  const p = patient();
  p.plan.reviewDate = "2026-10-24";
  p.plan.version = 3;
  p.plan.updatedAt = new Date(2026, 9, 16, 10).toISOString();
  p.checkIns = [
    { id: "c1", kind: "therapy", reason: "Gait", requestedAt: p.createdAt, requestedBy: "physio", status: "scheduled", scheduledFor: new Date(2026, 9, 20, 9, 30).toISOString(), visitNote: "", planVersion: null },
    { id: "c2", kind: "doctor_review", reason: "", requestedAt: p.createdAt, requestedBy: "patient", status: "requested", scheduledFor: null, visitNote: "", planVersion: null },
  ];
  const ev = calendarEvents(p);
  assert.ok(ev.some((e) => e.kind === "plan_change" && e.n === 3 && e.date === "2026-10-16"));
  assert.ok(ev.some((e) => e.kind === "doctor_review" && e.date === "2026-10-24"));
  assert.equal(ev.filter((e) => e.kind === "therapy").length, 1);
  const next = nextVisit(p, NOW)!;
  assert.equal(next.kind, "therapy");
  assert.equal(next.time, "09:30");
});

test(".ics file for the phone calendar", () => {
  const ics = buildIcs({ date: "2026-10-24", time: null }, "Doctor review, Langkah", "Bring your questions; notes", "uid-1", NOW);
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261024\r\nDTEND;VALUE=DATE:20261025/);
  assert.match(ics, /SUMMARY:Doctor review\\, Langkah/);
  assert.match(ics, /DESCRIPTION:Bring your questions\\; notes/);
  assert.match(buildIcs({ date: "2026-10-20", time: "09:30" }, "T", "", "u", NOW), /DTSTART:20261020T093000/);
});

test("exercise time said out loud, in three languages", () => {
  const cases: [string, string][] = [
    ["Ingatkan saya latihan jam 7 pagi", "07:00"],
    ["jam 4 sore", "16:00"],
    ["setengah 8 malam", "19:30"],
    ["at 7.30 pm", "19:30"],
    ["six thirty", ""],
    ["晚上8点半", "20:30"],
    ["早上7点", "07:00"],
    ["jam 1 siang", "13:00"],
  ];
  for (const [said, want] of cases) assert.equal(parseSpokenTime(said) ?? "", want, said);
});
