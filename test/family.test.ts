import assert from "node:assert/strict";
import { test } from "node:test";
import { seedCase } from "../shared/cases";
import { familyView, generateFamilyTasks, loadsBody, painWord, shareText, weeklyNews, weekFacts } from "../shared/family";
import { DAY, isoDate, type FamilyMember, type Patient } from "../shared/model";

const NOW = Date.parse("2026-10-17T10:00:00");
const budi = () => seedCase("budi", NOW)!;
const sari = () => seedCase("sari", NOW)!;
const member = (id: string, livesWithPatient: boolean): FamilyMember => ({ id, name: id, relation: "child", lang: "id", phone: null, livesWithPatient });
const fresh = (p: Patient, family: FamilyMember[]) => ({ ...p, family, familyTasks: [] });

test("painWord: 0 none, 1-3 mild, 4-6 moderate, 7-10 strong", () => {
  assert.equal(painWord(0), "none");
  assert.equal(painWord(1), "mild");
  assert.equal(painWord(3), "mild");
  assert.equal(painWord(4), "moderate");
  assert.equal(painWord(6), "moderate");
  assert.equal(painWord(7), "strong");
  assert.equal(painWord(10), "strong");
  assert.equal(painWord(null), null);
});

test("diabetes profile gets other-foot tasks; an injury profile does not", () => {
  const d = generateFamilyTasks(fresh(budi(), [member("a", true)]), NOW).map((t) => t.templateId);
  assert.ok(d.includes("other_foot_photo") && d.includes("check_shoes"));
  const i = generateFamilyTasks(fresh(sari(), [member("a", true)]), NOW).map((t) => t.templateId);
  assert.ok(!i.includes("other_foot_photo") && !i.includes("check_shoes"));
  assert.ok(i.includes("clear_walkway") && i.includes("bpjs_documents"));
});

test("one member gets every task; no family means no tasks", () => {
  const tasks = generateFamilyTasks(fresh(budi(), [member("a", false)]), NOW);
  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((t) => t.assigneeId === "a"));
  assert.equal(generateFamilyTasks(fresh(budi(), []), NOW).length, 0);
});

test("three members: home jobs to those at home, papers to the one away, shared evenly", () => {
  const tasks = generateFamilyTasks(fresh(budi(), [member("home1", true), member("home2", true), member("away", false)]), NOW);
  for (const t of tasks) {
    if (t.category === "admin" || t.category === "visit") assert.equal(t.assigneeId, "away");
    else assert.notEqual(t.assigneeId, "away");
  }
  const n1 = tasks.filter((t) => t.assigneeId === "home1").length;
  const n2 = tasks.filter((t) => t.assigneeId === "home2").length;
  assert.ok(Math.abs(n1 - n2) <= 1);
});

test("running again adds no duplicates of open tasks", () => {
  const p = fresh(budi(), [member("a", true)]);
  p.familyTasks = generateFamilyTasks(p, NOW);
  assert.equal(generateFamilyTasks(p, NOW).length, 0);
});

test("questions for the visit appear two days before the review date", () => {
  const p = fresh(budi(), [member("a", true)]);
  p.plan = { ...p.plan, reviewDate: isoDate(new Date(NOW + 1 * DAY)) };
  assert.ok(generateFamilyTasks(p, NOW).some((t) => t.templateId === "bring_questions"));
  p.plan = { ...p.plan, reviewDate: isoDate(new Date(NOW + 9 * DAY)) };
  assert.ok(!generateFamilyTasks(p, NOW).some((t) => t.templateId === "bring_questions"));
});

test("free text that loads the body is refused", () => {
  assert.equal(loadsBody("Help him walk to the gate"), true);
  assert.equal(loadsBody("Bantu Bapak berdiri"), true);
  assert.equal(loadsBody("Buy groceries"), false);
});

test("the family view leaves out the brief, diary, alert messages and clinical notes", () => {
  const p = budi();
  p.brief = { text: "SECRET BRIEF", lang: "en", generatedAt: null, editedAt: null };
  p.alerts.push({ id: "x", kind: "pain_high", severity: "high", message: "SECRET ALERT", at: new Date(NOW).toISOString(), for: ["physio"], sessionId: null, resolvedAt: null, resolvedBy: null });
  p.skinChecks.push({ id: "s", at: new Date(NOW).toISOString(), lang: "en", area: "other_foot", result: { usable: true, retakeTip: "", findings: [], urgency: "monitor", patientMessage: "", careTeamNote: "SECRET CARE NOTE" } });
  const v = familyView(p, NOW);
  const json = JSON.stringify(v);
  for (const secret of ["SECRET BRIEF", "SECRET ALERT", "SECRET CARE NOTE", "careTeamNote", "\"diary\"", "\"brief\""]) assert.ok(!json.includes(secret), secret);
  assert.equal(v.today.clinicNotified, true);
  assert.ok(!json.includes("Phantom pain"), "note summaries stay with the care team");
});

test("weekly news and share text use the reader's language", () => {
  const w = weekFacts(budi(), NOW);
  const id = weeklyNews("Pak Budi", w, "id", (d) => d);
  assert.match(id, /Pak Budi/);
  const text = shareText(generateFamilyTasks(fresh(budi(), [member("a", true)]), NOW).slice(0, 2), "id");
  assert.match(text, /Kosongkan jalur/);
  assert.match(text, /— Langkah$/);
});
