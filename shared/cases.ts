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
  type Goal,
  type Note,
  type Target,
  type FamilyMember,
  type FamilyTask,
  type Proposal,
  type ActivityEvent,
  defaultPreferences,
} from "./model";
import { generateFamilyTasks } from "./family";

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
  const base = { planHistory: [], skinChecks: [] as SkinCheck[], alerts: [] as Alert[], checkIns: [], createdAt: at(14), goals: [] as Goal[], notes: [] as Note[], preferences: defaultPreferences(), family: [] as FamilyMember[], familyTasks: [] as FamilyTask[], familyUpdate: null, letters: [], proposals: [] as Proposal[], activity: [] as ActivityEvent[] };
  const target = (text: string, o: Partial<Target> = {}): Target => ({ id: newId(), text, needsPhysioOk: false, physioOkAt: null, doneAt: null, targetMonth: null, source: "patient", ...o });
  const goal = (text: string, area: Goal["area"], main: boolean, targets: Target[], daysAgo: number): Goal => ({ id: newId(), text, area, main, createdAt: at(daysAgo), createdVia: "voice", targets });
  const note = (kind: Note["kind"], quote: string, summary: string, daysAgo: number, o: Partial<Note> = {}): Note => ({
    id: newId(), at: at(daysAgo, 19), kind, quote, summary, urgency: "normal", source: "companion", via: "voice", private: false, readAt: null, readBy: null, discussAtVisit: false, reply: "", ...o,
  });
  const brief = (lang: Patient["lang"]) => ({ text: "", lang, generatedAt: null, editedAt: null });

  // Pak Budi: diabetes, pain slowly rising, an open alert waiting for the physio.
  const budiV1 = plan(1, [{ exerciseId: "bridging", sets: 2, reps: 10 }], "", 10, 14);
  const budiPlan = plan(2, [
    { exerciseId: "bridging", sets: 2, reps: 10 },
    { exerciseId: "side-lying-abduction", sets: 2, reps: 10 },
  ], "Pelan-pelan saja. Gerakan yang benar lebih penting daripada cepat.", 3, 9);
  const budi: Patient = {
    ...base,
    id: "budi",
    name: "Pak Budi",
    age: 58,
    story: "Below-knee amputation after a diabetic foot wound. Pain has been creeping up this week.",
    lang: "id",
    profile: { level: "below_knee", side: "left", stage: "pre_prosthetic", cause: "diabetes", restrictions: "Periksa kaki kanan setiap hari." },
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
      memory("goal", "Ingin bisa jalan sendiri lagi ke tempat yang ia suka.", 13),
      memory("difficulty", "Angkat kaki ke samping terasa berat di set kedua.", 5),
      memory("preference", "Suka kalau pelatih menghitung pelan-pelan.", 8),
      memory("life", "Anak perempuannya membantu menggelar matras setiap pagi.", 10),
    ],
    diary: [
      diary("phantom_pain", 4, "malam hari", 12),
      diary("phantom_pain", 5, "", 8),
      diary("mood", 6, "", 8),
      diary("phantom_pain", 6, "rasa terbakar di kaki yang sudah tidak ada", 3),
      diary("mood", 4, "kesal, kemajuannya lambat", 1),
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
  ], "Kemajuannya bagus! Repetisi angkat pinggul ditambah minggu ini.", 10, 6);
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
      memory("goal", "Ingin kembali bekerja di usaha jahitnya.", 12),
      memory("motivation", "Semangat demi anaknya yang berumur 7 tahun.", 9),
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
    profile: { level: "below_knee", side: "right", stage: "pre_prosthetic", cause: "vascular", restrictions: "只能扶着助行器站立。" },
    plan: liemPlan,
    sessions: sessions(liemPlan, "zh", [[11, [[8, 8], [6, 6]], 3, 3, "ok"], [8, [[8, 7], [6, 5]], 3, 4, "hard"], [4, [[6, null], [4, null]], 4, 4, "hard"]]),
    memories: [memory("life", "孙女每个星期天来看他。", 8), memory("motivation", "喜欢听老的华语歌。", 11)],
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

  // Mas Rafi (PAS-20): below-elbow amputation of the right arm after a work accident.
  const rafiPlan = plan(2, [
    { exerciseId: "shoulder-blade-squeeze", sets: 2, reps: 10 },
    { exerciseId: "arm-raise-forward", sets: 2, reps: 10 },
    { exerciseId: "elbow-bend", sets: 2, reps: 12 },
    { exerciseId: "one-hand-practice", sets: 1, reps: 5 },
  ], "Minggu ini coba kancingkan baju dengan tangan kiri.", 12, 4);
  const rafi: Patient = {
    ...base,
    id: "rafi",
    name: "Mas Rafi",
    age: 27,
    story: "Below-elbow amputation of the right arm after an accident at work. Learning everyday tasks with his left hand.",
    lang: "id",
    profile: { limbs: [{ site: "upper", side: "right", level: "below_elbow" }], level: "none", side: "right", stage: "pre_prosthetic", cause: "injury", restrictions: "No lifting with the right arm until the next wound check." },
    plan: rafiPlan,
    sessions: sessions(rafiPlan, "id", [
      [5, [[10, 10], [10, 10], [12, 12], [5]], 2, 2, "ok"],
      [3, [[10, 10], [10, 9], [12, 12], [4]], 2, 3, "ok"],
      [1, [[10, 10], [10, 10], [12, 12], [5]], 1, 2, "easy"],
    ]),
    memories: [memory("goal", "Ingin kembali kerja di bengkel motor.", 10), memory("motivation", "Sedang menabung untuk menikah tahun depan.", 7)],
    diary: [diary("phantom_sensation", 4, "rasanya tangan kanan masih mengepal", 3), diary("mood", 6, "", 1)],
    brief: brief("id"),
  };

  // Goals in the patient's own words, broken into steps; body-loading steps wait for the physio's OK.
  budi.goals = [
    goal("Bisa jalan sendiri lagi ke tempat yang saya suka", "mobility", true, [
      target("Duduk di tepi tempat tidur 5 menit tanpa dibantu", { doneAt: at(10) }),
      target("Berdiri 1 menit dengan walker", { needsPhysioOk: true, physioOkAt: at(6), doneAt: at(4) }),
      target("Jalan 10 meter dengan walker", { needsPhysioOk: true, source: "physio" }),
      target("Jalan sampai pagar depan dengan walker", { needsPhysioOk: true }),
      target("Jalan ke ujung jalan dengan kaki palsu", { needsPhysioOk: true, targetMonth: date(75).slice(0, 7) }),
    ], 13),
    goal("Bermain dengan cucu di lantai", "family", false, [target("Turun ke lantai dan bangun lagi dengan bantuan", { needsPhysioOk: true })], 8),
  ];
  budi.notes = [
    note("complaint", "Kaki yang sudah tidak ada itu rasanya seperti terbakar kalau malam, saya jadi susah tidur.", "Phantom pain, burning, worse at night; affects sleep.", 3, { urgency: "watch", discussAtVisit: true }),
    note("worry", "Saya takut jadi beban buat istri saya.", "Worried about being a burden on his wife.", 5),
    note("need", "Kursi roda di rumah berat sekali, istri saya susah mendorongnya.", "Home wheelchair too heavy for his wife to push.", 6, { source: "typed", via: "text" }),
  ];
  budi.preferences = { ...defaultPreferences(), exerciseTime: "07:00", phone: "+62 812 0000 1234" };
  sari.goals = [
    goal("Kembali bekerja di usaha jahit saya", "work", true, [
      target("Berdiri di meja potong 10 menit", { needsPhysioOk: true, physioOkAt: at(9), doneAt: at(5) }),
      target("Berdiri 30 menit dengan istirahat sebentar", { needsPhysioOk: true, physioOkAt: at(3) }),
      target("Naik angkot ke toko bersama adik", { needsPhysioOk: true }),
      target("Bekerja setengah hari di toko", { needsPhysioOk: true, targetMonth: date(45).slice(0, 7) }),
    ], 12),
  ];
  sari.notes = [note("request", "Bisa latihannya sore saja? Pagi saya bantu di toko.", "Asks to move sessions to the evening (works mornings).", 2, { source: "typed", via: "text" })];
  sari.preferences = { ...defaultPreferences(), exerciseTime: "19:00" };
  liem.goals = [goal("和太太一起在公园散步", "mobility", true, [target("扶着助行器从椅子上站起来", { needsPhysioOk: true })], 9)];
  liem.notes = [note("worry", "我一个人在家的时候，怕摔倒。", "Afraid of falling when home alone.", 4, { urgency: "watch" })];

  // Family (DAT-02, DAT-03): who helps at home, and the jobs shared out from the approved templates.
  const member = (id: string, name: string, relation: FamilyMember["relation"], lang: FamilyMember["lang"], phone: string | null, livesWithPatient: boolean): FamilyMember => ({ id, name, relation, lang, phone, livesWithPatient });
  budi.family = [member("sri", "Bu Sri", "spouse", "id", "+62 812 0000 2201", true), member("dimas", "Dimas", "child", "id", "+62 813 0000 4410", false)];
  sari.family = [member("rani", "Rani", "sibling", "id", "+62 815 0000 3302", true)];
  liem.family = [member("mei", "Ibu Mei", "spouse", "zh", "+62 811 0000 5520", true), member("lin", "Lin", "other", "zh", null, false)];
  for (const p of [budi, sari, liem]) p.familyTasks = generateFamilyTasks(p, now - 2 * DAY);
  const walkway = budi.familyTasks.find((x) => x.templateId === "clear_walkway");
  if (walkway) Object.assign(walkway, { status: "done", doneAt: at(1, 17), doneBy: walkway.assigneeId });
  budi.notes.push(note("question", "Apakah Bapak sudah boleh dibonceng naik motor?", "Family question: may he ride pillion on a motorbike?", 2, { source: "family", via: "text", familyMemberId: "dimas" }));

  rafi.goals = [
    goal("Kembali kerja di bengkel", "work", true, [
      target("Mengancingkan baju dengan tangan kiri", { doneAt: at(2) }),
      target("Makan sampai habis dengan tangan kiri", {}),
      target("Mencoba pemasangan tangan palsu di klinik", { needsPhysioOk: true, targetMonth: date(60).slice(0, 7) }),
    ], 9),
  ];
  rafi.preferences = { ...defaultPreferences(), exerciseTime: "20:00" };

  return [budi, sari, liem, rafi, tester];
}
