// Morning triage for the care team (FIS-01): who needs you today, in a fixed order set by rules.
// Pure, so the server, the list screen and the tests agree. Thresholds: CLINICAL_REVIEW_NEEDED.

import { computeJourneyStage, type JourneyStep } from "./journey";
import { bySeverity, DAY, type AlertKind, type CareRole, type Patient, type PatientSummary, type Severity } from "./model";
import { MISSED_DAYS } from "./rules";

export type CareSignals = {
  alerts: { severity: Severity; kind: AlertKind; for: CareRole[] }[];
  unreadNotes: number;
  urgentNotes: number;
  goalsAwaitingOk: number;
  checkInRequested: boolean;
  /** FIS-06: a progression proposal waits for the physio. */
  proposalPending?: boolean;
  /** DOK-07: a discharge letter from the family waits for the doctor. */
  letter?: { id: string; from: string | null } | null;
  /** DOK-01: plan v1 from a discharge letter waits for the physio. */
  planAwaitingPhysio?: boolean;
  /** Days with at least one session in the last 7 days. */
  activeDays7: number;
  journeyStage: JourneyStep;
};
export type CareSummary = PatientSummary & CareSignals;

export function careSignals(p: Patient, now: number): CareSignals {
  const notes = p.notes.filter((n) => !n.private && !n.readAt);
  const days = new Set(p.sessions.filter((s) => now - Date.parse(s.at) < 7 * DAY && Date.parse(s.at) <= now).map((s) => s.at.slice(0, 10)));
  return {
    alerts: p.alerts.filter((a) => !a.resolvedAt).sort(bySeverity).map((a) => ({ severity: a.severity, kind: a.kind, for: a.for })),
    unreadNotes: notes.length,
    urgentNotes: notes.filter((n) => n.urgency === "now").length,
    goalsAwaitingOk: p.goals.flatMap((g) => g.targets).filter((t) => t.needsPhysioOk && !t.physioOkAt && !t.doneAt).length,
    checkInRequested: p.checkIns.some((c) => c.status === "requested"),
    proposalPending: (p.proposals ?? []).some((x) => x.status === "pending"),
    letter: ((l) => (l ? { id: l.id, from: p.family.find((m) => m.id === l.by)?.name ?? null } : null))((p.letters ?? []).find((l) => l.status === "awaiting_doctor")),
    planAwaitingPhysio: !!p.plan.awaitingPhysio,
    activeDays7: days.size,
    journeyStage: computeJourneyStage(p),
  };
}

export type TriageReason =
  | { kind: "alert"; severity: Severity; alert: AlertKind }
  | { kind: "urgent_note" }
  | { kind: "goals_ok"; n: number }
  | { kind: "proposal" }
  | { kind: "letter"; letterId: string; from: string | null }
  | { kind: "new_plan" }
  | { kind: "checkin" }
  | { kind: "review"; days: number }
  | { kind: "missed"; days: number }
  | { kind: "notes"; n: number };
export type TriageTab = "overview" | "notes" | "goals" | "sessions" | "profile" | "plan" | "visits" | "intake";
export type TriageItem = { patient: CareSummary; tier: number; reason: TriageReason; tab: TriageTab };

const DAYS = (from: string | null, now: number) => (from ? Math.floor((now - Date.parse(from)) / DAY) : null);
const overdue = (date: string, now: number) => Math.floor((now - Date.parse(`${date}T23:59:59`)) / DAY) + 1;

/**
 * One entry per patient who needs this role today, at the patient's most pressing reason.
 * Order: urgent → high → waiting for you (urgent note, goal OK, check-in) → review overdue → missed
 * → medium → low → unread notes. Inside a tier: more items first, then name.
 */
export function triage(rows: CareSummary[], role: CareRole, now: number): TriageItem[] {
  const out: TriageItem[] = [];
  for (const p of rows) {
    const mine = p.alerts.filter((a) => a.for.includes(role));
    const top = mine[0];
    const idle = DAYS(p.lastSessionAt, now);
    const late = overdue(p.reviewDate, now);
    const options: [number, TriageReason, TriageTab][] = [];
    if (top?.severity === "urgent") options.push([0, { kind: "alert", severity: "urgent", alert: top.kind }, "overview"]);
    if (top?.severity === "high") options.push([1, { kind: "alert", severity: "high", alert: top.kind }, "overview"]);
    if (p.urgentNotes) options.push([2, { kind: "urgent_note" }, "notes"]);
    if (role === "physio" && p.goalsAwaitingOk) options.push([2, { kind: "goals_ok", n: p.goalsAwaitingOk }, "goals"]);
    if (p.checkInRequested) options.push([2, { kind: "checkin" }, "visits"]);
    if (role === "doctor" && p.letter) options.push([2, { kind: "letter", letterId: p.letter.id, from: p.letter.from }, "intake"]);
    if (role === "physio" && p.planAwaitingPhysio) options.push([2, { kind: "new_plan" }, "plan"]);
    if (role === "physio" && p.proposalPending) options.push([2, { kind: "proposal" }, "overview"]);
    if (late > 0) options.push([3, { kind: "review", days: late }, role === "doctor" ? "profile" : "overview"]);
    if (idle !== null && idle >= MISSED_DAYS) options.push([4, { kind: "missed", days: idle }, "sessions"]);
    if (top?.severity === "medium") options.push([5, { kind: "alert", severity: "medium", alert: top.kind }, "overview"]);
    if (top?.severity === "low") options.push([6, { kind: "alert", severity: "low", alert: top.kind }, "overview"]);
    if (p.unreadNotes) options.push([7, { kind: "notes", n: p.unreadNotes }, "notes"]);
    const best = options.sort((a, b) => a[0] - b[0])[0];
    if (best) out.push({ patient: p, tier: best[0], reason: best[1], tab: best[2] });
  }
  return out.sort((a, b) => a.tier - b.tier || b.patient.alerts.length - a.patient.alerts.length || a.patient.name.localeCompare(b.patient.name));
}
