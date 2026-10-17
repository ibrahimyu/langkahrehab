// The family's side of Langkah (KEL-01…07): what they may see, the jobs they share, and the rules
// behind them. Pure functions, used by the server and the screens, with tests in test/family.test.ts.

import type { Lang } from "./exercises";
import { addDays, dayKey, nextVisit } from "./calendar";
import { t, type TextKey } from "./i18n";
import { templateById, TASK_TEMPLATES, type TaskTemplate } from "./familyTaskTemplates";
import {
  DAY,
  FAMILY_RELATIONS,
  FAMILY_TASKS_MAX,
  TASK_CATEGORIES,
  TASK_COSTS,
  newId,
  pick,
  pickLang,
  str,
  type DischargeLetter,
  type FamilyMember,
  type FamilyTask,
  type FamilyUpdate,
  type Patient,
  type Text3,
} from "./model";

/** Crisis line shown with 112 (KEL-06, SYS-01). TODO: verify number before production. */
export const CRISIS_LINE = "119";
/** Made-up clinic number, labelled "Demo" on screen. */
export const CLINIC_PHONE = "+62 21 5550 0199";

/** Pain as a word for the family (KEL-02): 0 none · 1–3 mild · 4–6 moderate · 7–10 strong. */
export type PainWord = "none" | "mild" | "moderate" | "strong";
export function painWord(n: number | null | undefined): PainWord | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  if (n <= 0) return "none";
  if (n <= 3) return "mild";
  if (n <= 6) return "moderate";
  return "strong";
}

export const textOf = (v: Text3 | string, lang: Lang) => (typeof v === "string" ? v : v[lang] || v.en);

/**
 * Free text from the family must not ask for standing, walking or other weight-bearing work:
 * those tasks only come from approved templates (KEL-03).
 */
const BODY_WORDS = /\b(stand|standing|walk|walking|stairs?|steps|jump|squat|kneel|lift|carry)\b|berdiri|jalan|berjalan|tangga|jongkok|melompat|angkat|站|走|楼梯|蹲|跳/i;
export const loadsBody = (text: string) => BODY_WORDS.test(text);

// ---- Task generation (KEL-03) ----

const HOME: FamilyTask["category"][] = ["home_safety", "equipment", "other_foot", "company"];

function wanted(p: Pick<Patient, "profile" | "plan">, now: number): TaskTemplate[] {
  const risky = p.profile.cause === "diabetes" || p.profile.cause === "vascular";
  const walker = /walker/i.test(p.profile.restrictions) || p.profile.stage === "pre_prosthetic";
  const review = p.plan.reviewDate;
  const today = dayKey(now);
  const visitSoon = !!review && review >= today && review <= addDays(today, 2);
  return TASK_TEMPLATES.filter((tpl) => {
    if (tpl.id === "borrow_walker") return walker;
    if (tpl.category === "other_foot") return risky;
    if (tpl.id === "bring_questions") return visitSoon;
    return true;
  });
}

/** True when this template already has a task that should stop a new copy. */
function covered(tpl: TaskTemplate, tasks: FamilyTask[], p: Pick<Patient, "plan">, now: number) {
  const same = tasks.filter((x) => x.templateId === tpl.id);
  if (same.some((x) => x.status === "open")) return true;
  if (!tpl.repeats) return same.length > 0;
  if (tpl.repeats === "per_visit") return same.some((x) => x.dueDate === p.plan.reviewDate);
  return same.some((x) => x.doneAt && now - Date.parse(x.doneAt) < 7 * DAY);
}

/**
 * Picks templates for this patient and shares them out (KEL-03). Members who live with the patient
 * get the home jobs; members further away get papers and visit questions. Each task goes to whoever
 * has the fewest open tasks. Never adds a copy of a template that is still open.
 */
export function generateFamilyTasks(p: Pick<Patient, "profile" | "plan" | "family" | "familyTasks">, now: number): FamilyTask[] {
  if (!p.family.length) return [];
  const iso = new Date(now).toISOString();
  const all = [...p.familyTasks];
  const load = new Map(p.family.map((m) => [m.id, all.filter((x) => x.assigneeId === m.id && x.status === "open").length]));
  const home = p.family.filter((m) => m.livesWithPatient);
  const away = p.family.filter((m) => !m.livesWithPatient);
  const made: FamilyTask[] = [];
  for (const tpl of wanted(p, now)) {
    if (covered(tpl, all, p, now)) continue;
    const isHome = HOME.includes(tpl.category);
    const pool = (isHome ? home : away).length ? (isHome ? home : away) : p.family;
    const who = pool.reduce((a, b) => ((load.get(b.id) ?? 0) < (load.get(a.id) ?? 0) ? b : a));
    load.set(who.id, (load.get(who.id) ?? 0) + 1);
    const task: FamilyTask = {
      id: newId(),
      templateId: tpl.id,
      title: { ...tpl.title },
      detail: { ...tpl.detail },
      assigneeId: who.id,
      category: tpl.category,
      cost: tpl.cost,
      dueDate: tpl.repeats === "per_visit" ? p.plan.reviewDate : tpl.repeats === "weekly" ? addDays(dayKey(now), 6) : null,
      status: "open",
      source: "template",
      createdAt: iso,
      doneAt: null,
      doneBy: null,
    };
    made.push(task);
    all.push(task);
  }
  return made;
}

/** Free first, then borrow, then buy; open before done. */
const costRank = { free: 0, borrow: 1, buy: 2 } as const;
export const byTaskOrder = (a: FamilyTask, b: FamilyTask) =>
  Number(a.status === "done") - Number(b.status === "done") || costRank[a.cost] - costRank[b.cost] || a.createdAt.localeCompare(b.createdAt);

/** Plain text to share one or more tasks, in the reader's language, signed "— Langkah". */
export function shareText(tasks: FamilyTask[], lang: Lang, heading?: string) {
  const lines = tasks.map((x) => `• ${textOf(x.title, lang)}${x.detail ? `\n  ${textOf(x.detail, lang)}` : ""}`);
  return [heading, ...lines, "— Langkah"].filter(Boolean).join("\n");
}

// ---- Input checks ----

export function sanitizeMember(b: any, fallbackLang: Lang): Omit<FamilyMember, "id"> | null {
  const name = str(b?.name, 60);
  if (!name) return null;
  const phone = str(b?.phone, 30).replace(/[^\d+ ()-]/g, "");
  return {
    name,
    relation: pick(b?.relation, FAMILY_RELATIONS, "other"),
    lang: b?.lang ? pickLang(b.lang) : fallbackLang,
    phone: phone || null,
    livesWithPatient: !!b?.livesWithPatient,
  };
}

export const validId = (v: unknown) => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : null);

/** A task written by a person (family or care team); category and cost from the allowed lists. */
export function sanitizeTaskInput(b: any) {
  return {
    title: str(b?.title, 120),
    detail: str(b?.detail, 400),
    category: pick(b?.category, TASK_CATEGORIES, "admin"),
    cost: pick(b?.cost, TASK_COSTS, "free"),
    dueDate: typeof b?.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) ? b.dueDate : null,
  };
}

export const capTasks = (tasks: FamilyTask[]) => {
  if (tasks.length <= FAMILY_TASKS_MAX) return tasks;
  // Drop the oldest done tasks first.
  const done = tasks.filter((x) => x.status === "done").sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? ""));
  const drop = new Set(done.slice(0, tasks.length - FAMILY_TASKS_MAX).map((x) => x.id));
  return tasks.filter((x) => !drop.has(x.id)).slice(-FAMILY_TASKS_MAX);
};

export { templateById };

// ---- What the family sees (KEL-01, ROL-06) ----

export type WeekFacts = { days: number; pain: PainWord | null; nextVisit: string | null };

export type FamilyView = {
  id: string;
  name: string;
  lang: Lang;
  family: FamilyMember[];
  tasks: FamilyTask[];
  today: { exercised: boolean; pain: PainWord | null; clinicNotified: boolean };
  nextVisit: { date: string; time: string | null } | null;
  /** The main goal and its steps, read-only (the journey in short). */
  goal: { text: string; steps: { text: string; done: boolean }[] } | null;
  week: WeekFacts;
  update: FamilyUpdate | null;
  /** Questions for the doctor from the patient and the family (not hidden ones), with answers. */
  questions: { id: string; at: string; text: string; fromFamily: boolean; memberId: string | null; reply: string; answered: boolean }[];
  letters: Omit<DischargeLetter, "image">[];
};

export function weekFacts(p: Patient, now: number): WeekFacts {
  const since = now - 7 * DAY;
  const recent = p.sessions.filter((s) => Date.parse(s.at) >= since && Date.parse(s.at) <= now);
  const pains = recent.map((s) => s.painAfter).filter((v): v is number => v !== null);
  return {
    days: new Set(recent.map((s) => dayKey(Date.parse(s.at)))).size,
    pain: painWord(pains.length ? Math.round(pains.reduce((a, b) => a + b, 0) / pains.length) : null),
    nextVisit: nextVisit(p, now)?.date ?? null,
  };
}

/**
 * The family's copy of the patient: no brief, diary, alert messages, clinical notes or skin findings.
 * An urgent or high alert shows only as "the clinic has been notified".
 */
export function familyView(p: Patient, now: number): FamilyView {
  const today = dayKey(now);
  const todays = p.sessions.filter((s) => dayKey(Date.parse(s.at)) === today);
  const visit = nextVisit(p, now);
  const main = [...p.goals].sort((a, b) => Number(b.main) - Number(a.main))[0];
  return {
    id: p.id,
    name: p.name,
    lang: p.lang,
    family: p.family,
    tasks: p.familyTasks,
    today: {
      exercised: todays.length > 0,
      pain: painWord(todays.at(-1)?.painAfter ?? null),
      clinicNotified: p.alerts.some((a) => !a.resolvedAt && (a.severity === "urgent" || a.severity === "high")),
    },
    nextVisit: visit ? { date: visit.date, time: visit.time } : null,
    goal: main ? { text: main.text, steps: main.targets.map((x) => ({ text: x.text, done: !!x.doneAt })) } : null,
    week: weekFacts(p, now),
    update: p.familyUpdate,
    questions: p.notes
      .filter((n) => n.kind === "question" && !n.private)
      .map((n) => ({ id: n.id, at: n.at, text: n.quote, fromFamily: n.source === "family", memberId: n.familyMemberId ?? null, reply: n.reply, answered: !!(n.reply || n.answeredAt) })),
    letters: p.letters.map(({ image, ...l }) => l),
  };
}

/** This week's news from numbers only (KEL-04 fallback; the AI version must say the same). */
export function weeklyNews(name: string, w: WeekFacts, lang: Lang, dateText: (d: string) => string) {
  const parts = [w.days ? t(lang, "famNewsDays", { name, n: w.days }) : t(lang, "famNewsNoDays", { name })];
  if (w.pain) parts.push(t(lang, "famNewsPain", { pain: t(lang, `painWord_${w.pain}` as TextKey) }));
  if (w.nextVisit) parts.push(t(lang, "famNewsVisit", { date: dateText(w.nextVisit) }));
  return parts.join(" ");
}
