// The shared data model: the contract between the patient flow and the care team side.
// Firestore: workspaces/{workspaceId} (Workspace) and workspaces/{workspaceId}/patients/{patientId} (Patient).
// A workspace is one copy of the data: each visitor (Firebase anonymous user) gets their own seeded patients.
// See docs/data-model.md.

import { LANGS, type Lang } from "./exercises";
import type { Level, Limb as PoseLimb, Side } from "./pose";
import { legacyFields, limbEnglish, limbsOf, sanitizeLimbs, type Limb } from "./limbs";

export const ROLES = ["patient", "family", "physio", "doctor"] as const;
export type Role = (typeof ROLES)[number];
/** The clinicians. Family is not part of the care team. */
export type CareRole = "physio" | "doctor";
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
export const CONCERNS = ["wound", "infection", "fall", "chest_pain", "breathing", "dizziness", "severe_pain", "distress", "other"] as const;
/** Who stopped the session: the coach (tool call), the app's own phrase check (SYS-01), the patient's own button, or an older simulated session. */
export type ConcernSource = "coach" | "keyword_fallback" | "patient" | "simulation";

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
  /** SYS-03: date (YYYY-MM-DD) of the last daily cycle, so running it twice adds nothing. */
  lastDailyCycle?: string | null;
  /** AI-06: morning triage sentences, cached per role per date. */
  triage?: Partial<Record<CareRole, TriageCache>>;
};
/** AI-06 cache: one sentence per patient, in the order the rules set. */
export type TriageCache = { date: string; key?: string; by: "ai" | "template"; items: { patientId: string; reason: string; action: TriageAction; lang: Lang }[] };
export const TRIAGE_ACTIONS = ["review_alert", "approve_or_reject_proposal", "call_patient", "prepare_visit", "check_family_tasks", "review_plan", "no_action"] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

/** Entered once by the doctor; every component reads it instead of asking again. */
export type Profile = {
  /** DAT-14: every amputation, leg or arm, one or more. Empty or missing = tester (or an old record: use limbsOf). */
  limbs?: Limb[];
  /** Derived from `limbs` (the first leg) so pose tracking keeps working; "none" when no leg is involved. */
  level: Level;
  /** Side of that leg, or for a tester or an arm-only profile, the exercising leg. */
  side: Side;
  stage: (typeof STAGES)[number];
  cause: (typeof CAUSES)[number];
  /** Free text from the doctor, e.g. "No kneeling". */
  restrictions: string;
  /** Doctor (DOK-02): other conditions, free text. */
  comorbidities?: string;
  /** Doctor (DOK-02): YYYY-MM-DD. */
  surgeryDate?: string | null;
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
  /** Doctor (DOK-02): highest dose the physio may set. null = default bounds (5 sets, 30 reps). */
  maxSets?: number | null;
  maxReps?: number | null;
  /** How this version was made (FIS-05 history). */
  source?: "manual" | "proposal" | "intake";
  /** DOK-01: plan v1 from a discharge letter waits for the physio to review it. Cleared by the next save. */
  awaitingPhysio?: boolean;
  updatedAt: string;
  updatedBy: Role;
};

export type Memory = {
  id: string;
  kind: MemoryKind;
  text: string;
  source: Source;
  createdAt: string;
  /** Set when the care team changes a memory (FIS-05). */
  editedBy?: CareRole | null;
  editedAt?: string | null;
};
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
  /** Average camera form score (0–100) per set; null where the camera did not score. */
  form?: (number | null)[];
};

export type SessionRecord = {
  id: string;
  /** Set by the browser; makes saving idempotent (a retry returns the first copy). */
  clientId?: string | null;
  at: string;
  planVersion: number;
  lang: Lang;
  mode: CountMode;
  exercises: SessionExercise[];
  painBefore: number | null;
  painAfter: number | null;
  difficulty: Difficulty | null;
  concern: { kind: ConcernKind; details: string; source?: ConcernSource } | null;
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

export type AlertKind = "red_flag" | "pain_high" | "pain_rising" | "missed_sessions" | "review_due" | "skin" | "wellbeing" | "other_foot" | "proposal_pending";
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
  /** SYS-04: i18n key + params so each reader sees the alert in their own language; `message` (EN) stays as fallback. */
  messageKey?: string | null;
  params?: Record<string, string | number>;
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

// ---- Goals and targets (PAS-14, DAT-16): the patient's own future, broken into concrete steps ----
export const GOAL_AREAS = ["mobility", "work", "family", "faith", "hobby", "sport", "self_care", "other"] as const;
export type GoalArea = (typeof GOAL_AREAS)[number];
export type Target = {
  id: string;
  text: string;
  /** Targets that load the body (standing, walking, stairs) need the physio's OK before they count. */
  needsPhysioOk: boolean;
  physioOkAt: string | null;
  doneAt: string | null;
  /** The patient's own plan ("2026-12"), never a promise. */
  targetMonth: string | null;
  source: "patient" | "physio" | "ai_suggestion";
};
export type Goal = { id: string; text: string; area: GoalArea; main: boolean; createdAt: string; createdVia: "voice" | "text" | "care_team"; targets: Target[] };

// ---- Notes for the care team (PAS-18, DAT-15): what the patient said, in their own words ----
export const NOTE_KINDS = ["complaint", "need", "worry", "request", "goal_change", "life_event", "question"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export type Note = {
  id: string;
  at: string;
  kind: NoteKind;
  /** The patient's own words. */
  quote: string;
  /** One line for the clinician. */
  summary: string;
  /** Set by rules (danger words), never by the model. "now" cannot be private. */
  urgency: "normal" | "watch" | "now";
  source: "coach" | "companion" | "typed" | "family";
  via: "voice" | "text";
  private: boolean;
  readAt: string | null;
  readBy: CareRole | null;
  discussAtVisit: boolean;
  /** The care team's answer, shown to the patient. */
  reply: string;
  /** Questions (PAS-05): when the patient marked it answered (e.g. asked at the visit). */
  answeredAt?: string | null;
  /** Set when a family member wrote it (KEL-05). */
  familyMemberId?: string | null;
  /** AI-10: how often the same thing was said within 7 days (merged duplicates). */
  mentions?: number;
  lastMentionedAt?: string | null;
};

export type Preferences = {
  /** "07:00": when the patient likes to exercise (reminders, calendar). */
  exerciseTime: string | null;
  exerciseDays: number[];
  phone: string;
  email: string;
};
export const defaultPreferences = (): Preferences => ({ exerciseTime: null, exerciseDays: [1, 2, 3, 4, 5, 6, 0], phone: "", email: "" });

export type Brief = { text: string; lang: Lang; generatedAt: string | null; editedAt: string | null };

// ---- Family (DAT-02, DAT-03, KEL-*): the people around the patient and the jobs they share ----
export const FAMILY_RELATIONS = ["spouse", "child", "parent", "sibling", "other"] as const;
export type FamilyRelation = (typeof FAMILY_RELATIONS)[number];
export type FamilyMember = { id: string; name: string; relation: FamilyRelation; lang: Lang; phone: string | null; livesWithPatient: boolean };
export const FAMILY_MAX = 6;
export type Text3 = Record<Lang, string>;
export const TASK_CATEGORIES = ["home_safety", "equipment", "other_foot", "company", "admin", "visit"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export const TASK_COSTS = ["free", "borrow", "buy"] as const;
export type TaskCost = (typeof TASK_COSTS)[number];
export type FamilyTask = {
  id: string;
  templateId: string | null;
  /** Template tasks carry all three languages; tasks written by people are one string. */
  title: Text3 | string;
  detail: Text3 | string;
  assigneeId: string | null;
  category: TaskCategory;
  cost: TaskCost;
  dueDate: string | null;
  status: "open" | "done";
  source: "template" | "rule" | "care_team" | "family";
  createdAt: string;
  doneAt: string | null;
  doneBy: string | null;
};
export const FAMILY_TASKS_MAX = 60;
/** This week's news for the family (KEL-04): plain words, no diagnosis. */
export type FamilyUpdate = { text: string; lang: Lang; generatedAt: string; by: "ai" | "template" | "care_team" };
/** A hospital discharge letter photo sent by the family (KEL-07). Only the care team sees the image. */
export type DischargeLetter = { id: string; at: string; by: string | null; image: string; status: "awaiting_doctor" | "reviewed" };

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
  goals: Goal[];
  notes: Note[];
  preferences: Preferences;
  family: FamilyMember[];
  familyTasks: FamilyTask[];
  familyUpdate: FamilyUpdate | null;
  letters: DischargeLetter[];
  /** FIS-06: progression proposals, newest last (max 20). At most one is pending. */
  proposals: Proposal[];
  /** FIS-08: who did what (AI, rules, people), newest last (max 200). */
  activity: ActivityEvent[];
  /** DOK-03 (DAT-06): prosthesis readiness, 7 criteria. Filled by withDefaults. */
  readiness?: Readiness;
  /** DOK-03: every change to a criterion, clearance or goal, newest last (max 100). */
  readinessLog?: ReadinessChange[];
  /** Doctor: cleared for prosthesis fitting (journey step 3). */
  clearedForFittingAt?: string | null;
  /** Doctor's reason when clearing before all 7 criteria are met. */
  clearedNote?: string;
  /** Doctor: walking toward the goal (journey step 5). */
  goalReachedAt?: string | null;
  createdAt: string;
};

// ---- Prosthesis readiness (DAT-06, DOK-03, FIS-07) ----
export const CRITERIA = ["wound", "volume", "range", "strength", "skin", "engagement", "falls_home"] as const;
export type Criterion = (typeof CRITERIA)[number];
export const READINESS_STATUSES = ["not_assessed", "not_yet", "progressing", "met"] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];
export type ReadinessItem = { status: ReadinessStatus; source: "auto" | CareRole; setAt: string | null; evidence: Evidence[]; note: string };
export type Readiness = Record<Criterion, ReadinessItem>;
export type ReadinessChange = { id: string; at: string; what: Criterion | "cleared" | "uncleared" | "goal" | "ungoal"; from: ReadinessStatus | null; to: ReadinessStatus | null; by: CareRole; note: string };
export const emptyReadiness = (): Readiness =>
  Object.fromEntries(CRITERIA.map((c) => [c, { status: "not_assessed", source: "auto", setAt: null, evidence: [], note: "" }])) as unknown as Readiness;

// ---- Proposals and the activity feed (DAT-05, DAT-07) ----
export type Evidence = { kind: "session" | "alert" | "diary" | "skin" | "memory" | "question" | "task" | "plan" | "note" | "proposal"; id: string; label: string };
export type ActivityActor = "ai" | "rule" | "human";
export type ActivityEvent = {
  id: string;
  at: string;
  actor: ActivityActor;
  /** Role or name of the person (human), "Langkah AI" (ai) or "Rules" (rule). */
  who: string;
  /** i18n key (act_*) */
  action: string;
  params: Record<string, string | number>;
  /** The person's own words, when there are any. */
  quote?: string | null;
  refs: Evidence[];
  /** Groups one daily cycle. */
  groupId: string | null;
};
export const REJECT_REASONS = ["too_soon", "pain", "technique", "patient_preference", "other"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];
export type ProposalChange = { exerciseId: string; field: "sets" | "reps"; from: number; to: number };
export type Proposal = {
  id: string;
  createdAt: string;
  basedOnPlanVersion: number;
  changes: ProposalChange[];
  eligibility: { rule: string; passed: boolean; value: string }[];
  rationale: Text3 | null;
  rationaleBy: "ai" | "template";
  evidence: Evidence[];
  status: "pending" | "approved" | "rejected" | "expired";
  decidedAt: string | null;
  decidedBy: CareRole | null;
  rejectReason: RejectReason | null;
  rejectNote?: string;
  resultPlanVersion: number | null;
};

/** Fills fields added after a workspace was seeded, so older demo copies keep working. */
export function withDefaults(p: Patient): Patient {
  p.goals ??= [];
  p.notes ??= [];
  p.family ??= [];
  p.familyTasks ??= [];
  p.familyUpdate ??= null;
  p.letters ??= [];
  p.proposals ??= [];
  p.activity ??= [];
  p.readiness = { ...emptyReadiness(), ...(p.readiness ?? {}) };
  p.readinessLog ??= [];
  p.clearedForFittingAt ??= null;
  p.goalReachedAt ??= null;
  p.preferences = { ...defaultPreferences(), ...(p.preferences ?? {}) };
  return p;
}

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
/** The clinic's calendar day (SYS-09): "YYYY-MM-DD" in the given time zone, not UTC (07:00 WIB is midnight UTC). */
export const DEFAULT_TZ = "Asia/Jakarta";
export const isoDate = (d: Date, tz = DEFAULT_TZ) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const DAY = 86_400_000;

/** The clock for a workspace: real time plus any offset kept from older data. */
export const nowFor = (w: Workspace | null) => Date.now() + (w?.offsetDays ?? 0) * DAY;

export const limbOf = (p: Profile): PoseLimb => ({ level: p.level, side: p.side });

/** One plain-English description of the patient for prompts and screens. */
export function describeProfile(p: Profile) {
  const limbs = limbsOf(p);
  if (!limbs.length) return `Test user without an amputation. Treat the ${p.side} leg as the leg that does the exercises.`;
  const where = limbs.map(limbEnglish).join("; ");
  const stage = p.stage === "prosthetic" ? "uses a prosthesis" : "does not have a prosthesis yet";
  const cause = p.cause === "unknown" ? "" : ` Cause: ${p.cause}.`;
  const restrictions = p.restrictions ? ` Restrictions from the doctor: ${p.restrictions}` : "";
  return `${where.charAt(0).toUpperCase()}${where.slice(1)}; ${stage}.${cause}${restrictions}`;
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

/** `limbs` wins; a body with only the older level/side fields is turned into one leg. */
function limbFields(p: any): Pick<Profile, "limbs" | "level" | "side"> {
  const side = pick<Side>(p?.side, ["left", "right"], "left");
  const limbs = Array.isArray(p?.limbs)
    ? sanitizeLimbs(p.limbs)
    : limbsOf({ level: pick<Level>(p?.level, ["none", "below_knee", "above_knee"], "below_knee"), side });
  return { limbs, ...legacyFields(limbs, side) };
}

export function sanitizeProfile(p: any): Profile {
  return {
    ...limbFields(p),
    stage: pick(p?.stage, STAGES, "pre_prosthetic"),
    cause: pick(p?.cause, CAUSES, "unknown"),
    restrictions: str(p?.restrictions, 500),
    comorbidities: str(p?.comorbidities, 300),
    surgeryDate: typeof p?.surgeryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.surgeryDate) ? p.surgeryDate : null,
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
