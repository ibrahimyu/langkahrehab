import type { Patient } from "./model";

const avg = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);

/** Numbers the brief and dashboard use as-is, so the model does not do its own arithmetic. */
export function patientStats(p: Patient) {
  const s = p.sessions;
  const setsPlanned = s.reduce((n, r) => n + r.exercises.reduce((m, e) => m + e.sets, 0), 0);
  const setsDone = s.reduce((n, r) => n + r.exercises.reduce((m, e) => m + e.logged.filter((v) => v !== null).length, 0), 0);
  const pairs = s.filter((r) => r.painBefore !== null && r.painAfter !== null);
  const phantom = p.diary.filter((d) => d.kind === "phantom_pain" && d.score !== null);
  return {
    sessions: s.length,
    firstSession: s[0]?.at.slice(0, 10) ?? null,
    lastSession: s.at(-1)?.at.slice(0, 10) ?? null,
    setsPlanned,
    setsDone,
    setAdherencePct: setsPlanned ? Math.round((setsDone / setsPlanned) * 100) : null,
    avgPainBefore: avg(s.map((r) => r.painBefore).filter((v): v is number => v !== null)),
    avgPainAfter: avg(s.map((r) => r.painAfter).filter((v): v is number => v !== null)),
    avgPainChange: avg(pairs.map((r) => r.painAfter! - r.painBefore!)),
    sessionsFeltHard: s.filter((r) => r.difficulty === "hard").length,
    sessionsStoppedForConcern: s.filter((r) => r.concern).length,
    phantomPainAvg: avg(phantom.map((d) => d.score!)),
    phantomPainLast: phantom.at(-1)?.score ?? null,
    openAlerts: p.alerts.filter((a) => !a.resolvedAt).length,
    skinChecksNeedingContact: p.skinChecks.filter((c) => c.result.urgency === "contact_soon" || c.result.urgency === "urgent").length,
  };
}

export type PatientStats = ReturnType<typeof patientStats>;
