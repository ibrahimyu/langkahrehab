// Prepared rehab cases for the demo, with two weeks of made-up history so no screen starts empty.
// All people here are fictional.

import {
  DAY,
  isoDate,
  newId,
  type Alert,
  type DiaryEntry,
  type Memory,
  type Patient,
  type Plan,
  type PlanItem,
  type SessionRecord,
  type SkinCheck,
} from "./model";

type SessionSeed = [daysAgo: number, logged: (number | null)[][], before: number, after: number, difficulty: SessionRecord["difficulty"]];

/** One prepared case, freshly seeded (scenario restarts). */
export const seedCase = (id: string, now: number) => seedCases(now).find((p) => p.id === id) ?? null;

export function seedCases(now: number): Patient[] {
  const at = (daysAgo: number, hour = 8) => new Date(now - daysAgo * DAY + (hour - 12) * 3_600_000).toISOString();
  const date = (daysFromNow: number) => isoDate(new Date(now + daysFromNow * DAY));

  const plan = (version: number, items: PlanItem[], note: string, reviewInDays: number, updatedDaysAgo: number): Plan => ({
    version, items, note, painThreshold: 7, reviewDate: date(reviewInDays), updatedAt: at(updatedDaysAgo, 10), updatedBy: "physio",
  });
  const sessions = (p: Plan, lang: Patient["lang"], seeds: SessionSeed[]): SessionRecord[] =>
    seeds.map(([daysAgo, logged, before, after, difficulty]) => ({
      id: newId(), at: at(daysAgo), planVersion: p.version, lang, mode: "camera",
      exercises: p.items.map((it, i) => ({ ...it, logged: logged[i] ?? Array(it.sets).fill(null) })),
      painBefore: before, painAfter: after, difficulty, concern: null, nextAction: { kind: "keep_going" }, source: "seed",
    }));
  const memory = (kind: Memory["kind"], text: string, daysAgo: number): Memory => ({ id: newId(), kind, text, source: "seed", createdAt: at(daysAgo) });
  const diary = (kind: DiaryEntry["kind"], score: number, note: string, daysAgo: number): DiaryEntry => ({ id: newId(), kind, score, note, source: "seed", at: at(daysAgo, 20) });
  const alert = (kind: Alert["kind"], severity: Alert["severity"], message: string, who: Alert["for"], daysAgo: number): Alert => ({
    id: newId(), kind, severity, message, at: at(daysAgo, 9), for: who, sessionId: null, resolvedAt: null, resolvedBy: null,
  });
  const base = { planHistory: [], skinChecks: [] as SkinCheck[], alerts: [] as Alert[], checkIns: [], createdAt: at(14) };
  const brief = (lang: Patient["lang"]) => ({ text: "", lang, generatedAt: null, editedAt: null });

  // Pak Budi: diabetes, pain slowly rising, an open alert waiting for the physio.
  const budiV1 = plan(1, [{ exerciseId: "bridging", sets: 2, reps: 10 }], "", 10, 14);
  const budiPlan = plan(2, [
    { exerciseId: "bridging", sets: 2, reps: 10 },
    { exerciseId: "side-lying-abduction", sets: 2, reps: 10 },
  ], "Go slowly. Doing the movement well matters more than speed.", 3, 9);
  const budi: Patient = {
    ...base,
    id: "budi",
    name: "Pak Budi",
    age: 58,
    story: "Below-knee amputation after a diabetic foot wound. Pain has been creeping up this week.",
    lang: "id",
    profile: { level: "below_knee", side: "left", stage: "pre_prosthetic", cause: "diabetes", restrictions: "Check the right foot every day." },
    plan: budiPlan,
    planHistory: [budiV1],
    sessions: [
      ...sessions(budiV1, "id", [[13, [[10, 10]], 2, 3, "ok"], [12, [[10, 9]], 2, 3, "ok"], [10, [[10, 10]], 3, 3, "ok"]]),
      ...sessions(budiPlan, "id", [
        [8, [[10, 10], [10, 8]], 3, 4, "ok"],
        [5, [[10, 9], [9, 7]], 3, 4, "hard"],
        [3, [[9, 8], [8, null]], 4, 5, "hard"],
        [1, [[8, 7], [7, null]], 4, 6, "hard"],
      ]),
    ],
    memories: [
      memory("goal", "Wants to walk to the mosque on his own again.", 13),
      memory("difficulty", "The side leg lift feels hard in the second set.", 5),
      memory("preference", "Likes the coach to count slowly.", 8),
      memory("life", "His daughter helps him set up the mat in the morning.", 10),
    ],
    diary: [
      diary("phantom_pain", 4, "at night", 12),
      diary("phantom_pain", 5, "", 8),
      diary("mood", 6, "", 8),
      diary("phantom_pain", 6, "burning feeling in the missing foot", 3),
      diary("mood", 4, "frustrated, slow progress", 1),
    ],
    skinChecks: [{
      id: newId(), at: at(4, 19), lang: "id", area: "residual_limb",
      result: {
        usable: true, retakeTip: "", urgency: "monitor",
        findings: [{ sign: "redness", area: "end of the amputated leg", confidence: 0.6 }],
        patientMessage: "Ada sedikit kemerahan di ujung kaki. Cek lagi setiap hari.",
        careTeamNote: "Mild redness at the distal end of the residual limb; no open wound.",
      },
    }],
    alerts: [alert("pain_rising", "medium", "Pain after sessions is rising: 4 → 5 → 6.", ["physio"], 1)],
    brief: brief("id"),
  };

  // Pak Budi's last session already advised a check-in (it raised the pain_rising alert).
  budi.sessions.at(-1)!.nextAction = { kind: "checkin_suggested" };

  // Ibu Sari: above-knee after a road accident, doing well with a prosthesis.
  const sariPlan = plan(3, [
    { exerciseId: "bridging", sets: 2, reps: 12 },
    { exerciseId: "sit-to-stand", sets: 2, reps: 8 },
  ], "Great progress! More bridging reps this week.", 10, 6);
  const sari: Patient = {
    ...base,
    id: "sari",
    name: "Ibu Sari",
    age: 34,
    story: "Above-knee amputation after a motorbike accident. Walking with a new prosthesis and doing well.",
    lang: "id",
    profile: { level: "above_knee", side: "right", stage: "prosthetic", cause: "injury", restrictions: "" },
    plan: sariPlan,
    sessions: sessions(sariPlan, "id", [
      [6, [[12, 12], [8, 8]], 1, 2, "ok"], [5, [[12, 12], [8, 8]], 1, 2, "ok"], [4, [[12, 12], [8, 8]], 1, 1, "easy"],
      [3, [[12, 12], [8, 8]], 1, 2, "ok"], [2, [[12, 12], [8, 7]], 2, 2, "ok"], [1, [[12, 12], [8, 8]], 1, 1, "easy"],
    ]),
    memories: [
      memory("goal", "Wants to go back to work at her tailoring shop.", 12),
      memory("motivation", "Does it for her son, who is 7.", 9),
    ],
    diary: [diary("phantom_sensation", 3, "tingling in the missing foot", 6), diary("mood", 8, "", 2)],
    brief: brief("id"),
  };

  // Pak Liem: speaks Mandarin, has stopped exercising for a few days.
  const liemPlan = plan(1, [
    { exerciseId: "bridging", sets: 2, reps: 8 },
    { exerciseId: "sit-to-stand", sets: 2, reps: 6 },
  ], "", 1, 12);
  const liem: Patient = {
    ...base,
    id: "liem",
    name: "Pak Liem",
    age: 67,
    story: "Below-knee amputation from poor circulation. Prefers Mandarin. No exercise for 4 days.",
    lang: "zh",
    profile: { level: "below_knee", side: "right", stage: "pre_prosthetic", cause: "vascular", restrictions: "Stand only with the walker." },
    plan: liemPlan,
    sessions: sessions(liemPlan, "zh", [[11, [[8, 8], [6, 6]], 3, 3, "ok"], [8, [[8, 7], [6, 5]], 3, 4, "hard"], [4, [[6, null], [4, null]], 4, 4, "hard"]]),
    memories: [memory("life", "His granddaughter visits on Sundays.", 8), memory("motivation", "Likes old Mandarin songs.", 11)],
    diary: [diary("phantom_pain", 5, "", 8), diary("mood", 3, "lonely", 4)],
    alerts: [alert("missed_sessions", "low", "No exercise session for 4 days.", ["physio"], 0)],
    brief: brief("zh"),
  };

  // A blank case for judges and testers to try with their own body.
  const testerPlan = plan(1, [
    { exerciseId: "bridging", sets: 2, reps: 5 },
    { exerciseId: "sit-to-stand", sets: 2, reps: 5 },
  ], "", 14, 3);
  const tester: Patient = {
    ...base,
    id: "tester",
    name: "Tester",
    age: 30,
    story: "Try it yourself: no amputation needed. Short plan, English coach.",
    lang: "en",
    profile: { level: "none", side: "left", stage: "pre_prosthetic", cause: "unknown", restrictions: "" },
    plan: testerPlan,
    sessions: [],
    memories: [],
    diary: [],
    brief: brief("en"),
  };

  return [budi, sari, liem, tester];
}
