// The shared data model: the contract between the patient flow and the care team side.
// Firestore: workspaces/{workspaceId} (Workspace) and workspaces/{workspaceId}/patients/{patientId} (Patient).
// A workspace is one demo copy: each visitor (Firebase anonymous user) gets their own seeded patients.
// See docs/data-model.md.

import { LANGS, type Lang } from "./exercises";
import type { Level, Limb, Side } from "./pose";

export type Role = "patient" | "physio" | "doctor";
export type CareRole = Exclude<Role, "patient">;
export type CountMode = "camera" | "patient" | "coach";

export const STAGES = ["pre_prosthetic", "prosthetic"] as const;
export const CAUSES = ["diabetes", "vascular", "injury", "cancer", "other", "unknown"] as const;
export const MEMORY_KINDS = ["goal", "motivation", "difficulty", "preference", "life", "other"] as const;
export const DIARY_KINDS = ["phantom_pain", "phantom_sensation", "mood"] as const;
export const SOURCES = ["coach", "patient", "care_team", "seed"] as const;
export const URGENCY = ["none", "monitor", "contact_soon", "urgent"] as const;
export const SKIN_SIGNS = [
  "redness", "swelling", "open_wound", "blister", "scab", "dark_discoloration", "drainage", "rash", "other",
] as const;
export const CONCERNS = ["wound", "infection", "fall", "chest_pain", "breathing", "dizziness", "severe_pain", "other"] as const;

export type Source = (typeof SOURCES)[number];
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export type DiaryKind = (typeof DIARY_KINDS)[number];
export type Urgency = (typeof URGENCY)[number];
export type SkinSign = (typeof SKIN_SIGNS)[number];
export type ConcernKind = (typeof CONCERNS)[number];
export type Difficulty = "easy" | "ok" | "hard";

export type Workspace = {
  createdAt: string;
  /** Days added by the demo "next day" button. All dates use `now(workspace)`. */
  offsetDays: number;
};

/** Entered once by the doctor; every component reads it instead of asking again. */
export type Profile = {
  level: Level;
  /** Amputated side, or for a tester without an amputation, the exercising leg. */
  side: Side;
  stage: (typeof STAGES)[number];
  cause: (typeof CAUSES)[number];
  /** Free text from the doctor, e.g. "No kneeling". */
  restrictions: string;
};

export type PlanItem = { exerciseId: string; sets: number; reps: number };

/** The exercise plan. The physio sets `items`; the doctor sets the clinical limits. Every save is a new version. */
export type Plan = {
  version: number;
  items: PlanItem[];
  /** Short note from the physio, shown to the patient. */
  note: string;
  /** Doctor: pain after a session at or above this raises an alert. */
  painThreshold: number;
  /** Doctor: date (YYYY-MM-DD) of the next review visit. */
  reviewDate: string;
  updatedAt: string;
  updatedBy: Role;
};

export type Memory = { id: string; kind: MemoryKind; text: string; source: Source; createdAt: string };
/** Score 0–10: pain intensity for phantom pain/sensation; 0 = very low, 10 = very good for mood. */
export type DiaryEntry = { id: string; kind: DiaryKind; score: number | null; note: string; source: Source; at: string };

export type NextActionKind = "keep_going" | "stop_contact" | "rest_contact" | "checkin_suggested" | "review_due";
export type NextAction = { kind: NextActionKind; detail?: string };

export type SessionExercise = {
  exerciseId: string;
  sets: number;
  reps: number;
  /** Reps per set as logged (camera count in camera mode); null = set not done. */
  logged: (number | null)[];
};

export type SessionRecord = {
  id: string;
  at: string;
  planVersion: number;
  lang: Lang;
  mode: CountMode;
  exercises: SessionExercise[];
  painBefore: number | null;
  painAfter: number | null;
  difficulty: Difficulty | null;
  concern: { kind: ConcernKind; details: string } | null;
  nextAction: NextAction;
  source: "session" | "seed";
};

export type SkinResult = {
  usable: boolean;
  retakeTip: string;
  findings: { sign: SkinSign; area: string; confidence: number }[];
  urgency: Urgency;
  patientMessage: string;
  careTeamNote: string;
};
export type SkinArea = "residual_limb" | "other_foot";
export type SkinCheck = { id: string; at: string; lang: Lang; area: SkinArea; result: SkinResult };

export type AlertKind = "red_flag" | "pain_high" | "pain_rising" | "missed_sessions" | "review_due" | "skin";
export type Severity = "urgent" | "high" | "medium" | "low";
export type Alert = {
  id: string;
  kind: AlertKind;
  severity: Severity;
  /** One sentence for the care team, in English. */
  message: string;
  at: string;
  /** Who should act on it. */
  for: CareRole[];
  sessionId: string | null;
  resolvedAt: string | null;
  resolvedBy: CareRole | null;
};

export type CheckIn = {
  id: string;
  kind: "doctor_review" | "therapy";
  reason: string;
  requestedAt: string;
  requestedBy: Role;
  status: "requested" | "scheduled" | "done";
  scheduledFor: string | null;
  /** Written by the care team at the visit. */
  visitNote: string;
  /** Plan version saved at the visit, if the plan changed. */
  planVersion: number | null;
};

export type Brief = { text: string; lang: Lang; generatedAt: string | null; editedAt: string | null };

export type Patient = {
  id: string;
  name: string;
  age: number;
  /** One line shown on the case picker. */
  story: string;
  /** Language the patient uses with the coach and the app. */
  lang: Lang;
  profile: Profile;
  plan: Plan;
  /** Earlier plan versions, oldest first. */
  planHistory: Plan[];
  memories: Memory[];
  diary: DiaryEntry[];
  sessions: SessionRecord[];
  skinChecks: SkinCheck[];
  alerts: Alert[];
  checkIns: CheckIn[];
  brief: Brief;
  createdAt: string;
};

/** What the patient list needs, without the full history. */
export type PatientSummary = Pick<Patient, "id" | "name" | "age" | "story" | "lang" | "profile"> & {
  openAlerts: number;
  topSeverity: Severity | null;
  lastSessionAt: string | null;
  reviewDate: string;
};

// ---- Helpers shared by client and server ----

export const newId = () => crypto.randomUUID();
export const pickLang = (v: unknown): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : "id");
export const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const score = (v: unknown) => {
  const n = Number(v);
  return v !== null && v !== "" && v !== undefined && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
};
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const DAY = 86_400_000;

/** The demo clock: real time plus the days added with "next day". */
export const nowFor = (w: Workspace | null) => Date.now() + (w?.offsetDays ?? 0) * DAY;

export const limbOf = (p: Profile): Limb => ({ level: p.level, side: p.side });

/** One plain-English description of the patient for prompts and screens. */
export function describeProfile(p: Profile) {
  if (p.level === "none") return `Test user without an amputation. Treat the ${p.side} leg as the leg that does the exercises.`;
  const level = p.level === "below_knee" ? "Below-knee" : "Above-knee";
  const stage = p.stage === "prosthetic" ? "uses a prosthesis" : "does not have a prosthesis yet";
  const cause = p.cause === "unknown" ? "" : ` Cause: ${p.cause}.`;
  const restrictions = p.restrictions ? ` Restrictions from the doctor: ${p.restrictions}` : "";
  return `${level} amputation of the ${p.side} leg; ${stage}.${cause}${restrictions}`;
}

export const openAlerts = (p: Patient) => p.alerts.filter((a) => !a.resolvedAt);

const severityRank: Record<Severity, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
export const bySeverity = (a: { severity: Severity }, b: { severity: Severity }) => severityRank[a.severity] - severityRank[b.severity];

export function summarize(p: Patient): PatientSummary {
  const open = openAlerts(p).sort(bySeverity);
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    story: p.story,
    lang: p.lang,
    profile: p.profile,
    openAlerts: open.length,
    topSeverity: open[0]?.severity ?? null,
    lastSessionAt: p.sessions.at(-1)?.at ?? null,
    reviewDate: p.plan.reviewDate,
  };
}

// ---- Validation of client input ----

export function sanitizeProfile(p: any): Profile {
  return {
    level: pick<Level>(p?.level, ["none", "below_knee", "above_knee"], "below_knee"),
    side: pick<Side>(p?.side, ["left", "right"], "left"),
    stage: pick(p?.stage, STAGES, "pre_prosthetic"),
    cause: pick(p?.cause, CAUSES, "unknown"),
    restrictions: str(p?.restrictions, 500),
  };
}

export function sanitizeMemory(m: any, source: Source, at: string): Memory | null {
  const text = str(m?.text, 300);
  if (!text) return null;
  return { id: str(m?.id, 64) || newId(), kind: pick(m?.kind, MEMORY_KINDS, "other"), text, source, createdAt: str(m?.createdAt, 40) || at };
}

export function sanitizeDiaryEntry(d: any, source: Source, at: string): DiaryEntry | null {
  const entry: DiaryEntry = {
    id: str(d?.id, 64) || newId(),
    kind: pick(d?.kind, DIARY_KINDS, "phantom_pain"),
    score: score(d?.score),
    note: str(d?.note, 300),
    source,
    at: str(d?.at, 40) || at,
  };
  return entry.score === null && !entry.note ? null : entry;
}
