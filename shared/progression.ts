// Progression proposals (FIS-06, DAT-05). Rules decide whether a patient is ready and by how much the
// dose moves; the AI only writes the reason (AI-05); the physio decides. Pure, so the server, the
// "check now" screen and the tests agree. Every threshold here is CLINICAL_REVIEW_NEEDED (docs/DECISIONS.md).

import { exerciseById, LANGS, type Lang } from "./exercises";
import { t } from "./i18n";
import { DAY, newId, type Evidence, type Patient, type Proposal, type ProposalChange, type Text3 } from "./model";

export const PROG = {
  /** Days with a session in the last 7 days. */
  minActiveDays: 5,
  /** Pain after every session must be at most painThreshold − this. */
  painMargin: 3,
  /** Sessions rated easy or ok. */
  minEasyOk: 4,
  /** Logged reps as a share of the planned reps. */
  minRepsShare: 0.9,
  /** Days the plan must stay unchanged. */
  planStableDays: 7,
  repStep: 2,
  setStep: 1,
  maxExercises: 2,
  /** Default bounds when the doctor set no maximum (same as PUT /plan). */
  defaultMaxSets: 5,
  defaultMaxReps: 30,
} as const;

export type EligibilityRule = "sessions" | "pain" | "alerts" | "effort" | "reps" | "plan_stable" | "no_pending";
export type Eligibility = { rule: EligibilityRule; passed: boolean; value: string };
export type ProgressionResult = { eligible: boolean; eligibility: Eligibility[]; changes: ProposalChange[]; atMax: boolean; evidence: Evidence[] };

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Which rules pass for this patient now, and the dose change the rules would suggest. */
export function evaluateProgression(p: Patient, now: number): ProgressionResult {
  const recent = p.sessions.filter((s) => Date.parse(s.at) <= now && now - Date.parse(s.at) < 7 * DAY);
  const days = new Set(recent.map((s) => s.at.slice(0, 10))).size;
  const painLimit = p.plan.painThreshold - PROG.painMargin;
  const pains = recent.map((s) => s.painAfter).filter((v): v is number => v !== null);
  const worstPain = pains.length ? Math.max(...pains) : null;
  const badAlerts = p.alerts.filter((a) => now - Date.parse(a.at) < 7 * DAY && a.kind !== "proposal_pending" && a.severity !== "low");
  const flags = recent.filter((s) => s.concern).length;
  const easyOk = recent.filter((s) => s.difficulty === "easy" || s.difficulty === "ok").length;
  let planned = 0;
  let done = 0;
  for (const s of recent)
    for (const e of s.exercises) {
      planned += e.sets * e.reps;
      done += e.logged.reduce<number>((n, v) => n + (v ?? 0), 0);
    }
  const share = planned ? done / planned : 0;
  const planAge = Math.floor((now - Date.parse(p.plan.updatedAt)) / DAY);
  const pending = p.proposals.some((x) => x.status === "pending");

  const eligibility: Eligibility[] = [
    { rule: "sessions", passed: days >= PROG.minActiveDays, value: `${days}/7` },
    { rule: "pain", passed: worstPain !== null && worstPain <= painLimit, value: worstPain === null ? "–" : `${worstPain} ≤ ${painLimit}` },
    { rule: "alerts", passed: badAlerts.length === 0 && flags === 0, value: String(badAlerts.length + flags) },
    { rule: "effort", passed: easyOk >= PROG.minEasyOk, value: `${easyOk}/${recent.length}` },
    { rule: "reps", passed: share >= PROG.minRepsShare, value: `${Math.round(share * 100)}%` },
    { rule: "plan_stable", passed: planAge >= PROG.planStableDays, value: `${planAge}/${PROG.planStableDays}` },
    { rule: "no_pending", passed: !pending, value: pending ? "1" : "0" },
  ];
  const eligible = eligibility.every((e) => e.passed);

  const maxSets = p.plan.maxSets ?? PROG.defaultMaxSets;
  const maxReps = p.plan.maxReps ?? PROG.defaultMaxReps;
  const changes: ProposalChange[] = [];
  for (const i of p.plan.items) {
    if (changes.length >= PROG.maxExercises) break;
    if (i.reps + PROG.repStep <= maxReps) changes.push({ exerciseId: i.exerciseId, field: "reps", from: i.reps, to: i.reps + PROG.repStep });
    else if (i.sets + PROG.setStep <= maxSets) changes.push({ exerciseId: i.exerciseId, field: "sets", from: i.sets, to: i.sets + PROG.setStep });
  }
  const evidence: Evidence[] = recent.slice(-5).map((s) => ({
    kind: "session",
    id: s.id,
    label: `Session ${dayLabel(s.at)} · pain ${s.painBefore ?? "?"}→${s.painAfter ?? "?"}`,
  }));
  return { eligible, eligibility, changes: eligible ? changes : [], atMax: eligible && changes.length === 0, evidence };
}

/** "Bridging 12 → 14 reps" in one language. */
export function changeText(lang: Lang, c: ProposalChange) {
  const name = exerciseById(c.exerciseId)?.name[lang] ?? c.exerciseId;
  return `${name} ${c.from} → ${c.to} ${t(lang, c.field === "reps" ? "progReps" : "progSets")}`;
}

/** AI-05 fallback: the reason from the rule values, in all three languages. */
export function templateRationale(p: Patient, r: ProgressionResult): Text3 {
  const v = (rule: EligibilityRule) => r.eligibility.find((e) => e.rule === rule)?.value ?? "–";
  const pain = p.plan.painThreshold - PROG.painMargin;
  const out = {} as Text3;
  for (const lang of LANGS)
    out[lang] = t(lang, "progTemplate", { a: v("sessions").split("/")[0]!, b: pain, c: v("effort"), diff: r.changes.map((c) => changeText(lang, c)).join(", ") });
  return out;
}

/** A new pending proposal from a passing evaluation. */
export function makeProposal(p: Patient, r: ProgressionResult, at: string, rationale: Text3, by: "ai" | "template", evidence: Evidence[] = r.evidence): Proposal {
  return {
    id: newId(),
    createdAt: at,
    basedOnPlanVersion: p.plan.version,
    changes: r.changes,
    eligibility: r.eligibility,
    rationale,
    rationaleBy: by,
    evidence,
    status: "pending",
    decidedAt: null,
    decidedBy: null,
    rejectReason: null,
    resultPlanVersion: null,
  };
}

/** Pending proposals made for an older plan expire when the plan changes another way. */
export function expireStale(p: Patient, at: string) {
  for (const x of p.proposals)
    if (x.status === "pending" && x.basedOnPlanVersion !== p.plan.version) {
      x.status = "expired";
      x.decidedAt = at;
    }
  for (const a of p.alerts) if (a.kind === "proposal_pending" && !a.resolvedAt && !p.proposals.some((x) => x.status === "pending")) a.resolvedAt = at;
}

export const pendingProposal = (p: Patient) => p.proposals.find((x) => x.status === "pending") ?? null;
