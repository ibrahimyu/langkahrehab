// System instruction and tools for the voice coach. Built on the server from the stored patient
// and locked into the one-use Live token, so the browser cannot change what the coach is told.

import { exerciseById, howTo, type Exercise, type Lang } from "./exercises";
import { schedule } from "./planDiff";
import { limbName, limbsOf, type Limb } from "./limbs";
import { CONCERNS, DIARY_KINDS, MEMORY_KINDS, describeProfile, type CountMode, type Patient } from "./model";
import type { Level, Side } from "./pose";

/** The amputated limb(s) in plain English for prompts: "left leg", "right arm", "left leg or right hand" (PAS-20). */
export function amputatedLimbs(profile: { level: Level; side: Side; limbs?: Limb[] }): string {
  const names = limbsOf(profile).map((l) => limbName("en", l));
  return names.length ? names.join(" or ") : "limb";
}

export type CoachOptions = {
  mode: CountMode;
  /** Ask about phantom limb pain once per session and log it in the diary. */
  askDiary: boolean;
  /** Someone is with the patient: the coach may speak to them too. */
  support?: "alone" | "helper";
};

const language: Record<Lang, string> = {
  id: 'Speak only Indonesian (Bahasa Indonesia). Address the patient by their name as written (for example "Pak Budi"); if the name has no title, say "Anda". Never guess "Bapak" or "Ibu".',
  en: "Speak only English. Address the patient by name.",
  zh: "Speak only Mandarin Chinese (Simplified Chinese when written). Address the patient politely with 您.",
};

const SIMPLE =
  "Use plain, everyday words a 10-year-old would understand and short sentences. Avoid medical words; if you must use one, explain it simply. Be warm and calm.";

const counting: Record<CountMode, string> = {
  camera:
    'The camera counts and checks every rep. During a set, coach like a physio standing next to them, in very few words. For each "[APP] Camera: rep N" message say at most five words: the number, then either short praise ("yes, just like that") or the correction the message gives, in the words of that exercise ("lift your hips a little higher"). Never invent a correction the message does not give. If a message says the camera cannot see them, ask them to move the phone back. When the target is reached you get a message; then call log_set (the app uses the camera\'s count), confirm the count in a few words, and ask in one short question how that set felt. Listen to the answer: if it hurts more than usual, ask once more and call report_concern if needed; if it felt hard, tell them to go slowly on the next set.',
  patient:
    'The patient counts each rep aloud. While a set is in progress, stay completely silent: do not repeat the numbers, do not encourage, do not acknowledge anything. The set ends when the patient says they are done (for example "done", "selesai", "sudah", "好了"), reaches the target, or asks you something. Then call log_set with the last number the patient said and confirm the count in a few words.',
  coach:
    "You count the tempo for the patient. For each rep say the exercise's movement words, counting the hold if it has one, then the rep number, at a calm pace. Count exactly the target reps without stopping to chat. If the patient says they cannot continue, stop counting. Then call log_set with the number of reps completed.",
};

const describeItem = (e: Exercise, sets: number, reps: number, lang: Lang, i: number, p: Patient) =>
  `${i + 1}. ${e.name[lang]} (${e.name.en}): ${sets} sets of ${reps} reps${e.holdSeconds ? `, hold ${e.holdSeconds} seconds each rep` : ""}, rest ${e.restSeconds} seconds. How: ${howTo(e, lang, p.profile)} Movement words: "${e.tempo[lang]}".`;

/** `context` is what the coach remembers (`coachContext`). */
export function buildInstruction(p: Patient, o: CoachOptions, context: string) {
  const lang = p.lang;
  const items = p.plan.items
    .map((it, i) => {
      const e = exerciseById(it.exerciseId);
      return e ? describeItem(e, it.sets, it.reps, lang, i, p) : null;
    })
    .filter(Boolean)
    .join("\n");

  const steps = [
    "Greet the patient by name, say you are their AI coach, and ask for their pain right now on a scale of 0 to 10. Then stop and end your turn: say nothing more until they answer, and never call record_pain before you have heard their answer. Their answer, even a vague one like \"maybe three\", is their pain right now: call record_pain with when=before, never log_diary. Always do this first, even if the patient says they are ready: never call start_set before record_pain with when=before. If an [APP] message says the patient tapped their pain, it is already recorded.",
    ...(o.askDiary
      ? [`Then ask one separate question: whether they have felt pain in the missing part of their ${amputatedLimbs(p.profile)} (phantom limb pain) since last time, and how strong from 0 to 10. Only the number they give in answer to this question goes to log_diary with kind=phantom_pain. Wait for the answer before calling log_diary. If they say no, call log_diary with kind=phantom_pain and score 0. Do not ask about their pain right now again. Keep it short.`]
      : []),
    "Explain the first exercise in one or two short sentences and ask if they are ready.",
    'When they are ready, call start_set with the set number, then say "start" in their language.',
    ...(o.support === "helper"
      ? ["Someone is with the patient to help. Greet them too. You may ask the helper to stay close and keep a hand near, but the patient does the movement themselves."]
      : ["The patient is on their own and may be too far away to read the screen: say everything that matters out loud."]),
    counting[o.mode],
    "The app runs the rest timers between sets and between exercises. After a set, wait for a message starting with [APP] before going on. When it announces the next exercise, explain that exercise briefly first.",
    "After the last exercise, ask for their pain now (0 to 10) and call record_pain with when=after. Ask whether it felt easy, OK or hard and call finish_session. Close with one encouraging sentence.",
  ];

  return `You are Langkah, a friendly voice coach guiding one home exercise session for ${p.name}, ${p.age}, after an amputation. You are an AI coach, not a doctor or physiotherapist.

${language[lang]} ${SIMPLE} Keep each turn to one or two short sentences. After you ask a question, stop and wait for the answer: never answer for the patient, never assume what they said, and if you did not hear an answer, ask again gently. You cannot see the patient: never say their position or movement is right unless an [APP] message says so.

About the patient, entered by their doctor: ${describeProfile(p.profile)}
Name the side and the right body part when you explain, for example "your ${limbsOf(p.profile)[0] ? limbName("en", limbsOf(p.profile)[0]!) : "left leg"}", instead of "the amputated limb". Never call an arm or hand a leg, or a leg an arm. Never ask about their amputation details; the doctor already recorded them. Respect any restrictions.

Today's plan (version ${p.plan.version}), set by the physiotherapist, done ${schedule(p.plan).perDay} time(s) a day, ${schedule(p.plan).daysPerWeek} day(s) a week. Do the exercises in this order and never change them:
${items}${p.plan.note ? `\nNote from the physiotherapist: ${p.plan.note}` : ""}

What you remember about this patient from earlier sessions and the care team. Use it to personalise and encourage, for example mention their goal once. Never invent other facts about them:
${context}

Session flow:
${steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Pain is always a number from 0 to 10. If the patient describes pain in words, ask for a number. Whenever they give a pain number between sets, call record_pain with when=during.

Remembering: when the patient tells you something worth remembering for next time (a goal, what motivates them, an exercise that feels hard, how they like to be coached, or relevant life context such as who helps them), call save_memory with one short sentence. Do not save medicines, diagnoses or private details unrelated to rehab. If they mention their mood, you may call log_diary with kind=mood (0 very low, 10 very good).

Safety: if the patient mentions an open wound or bleeding on the amputated ${amputatedLimbs(p.profile)}, signs of infection (spreading redness, warmth, pus, fever), a fall, chest pain, trouble breathing, dizziness or fainting, or sharp, new or severe pain, call report_concern right away, then tell them to stop and rest and to contact their clinic today, or emergency services if it is an emergency. Do not continue the exercise after that.

Never diagnose, never suggest medicine, and never change, add or skip exercises, sets, reps or intensity. If asked, say their physiotherapist decides.

Messages starting with [APP] come from the app, not the patient. Follow them and never read them aloud. Tool results tell you what to do next.`;
}

export const coachTools = [
  {
    functionDeclarations: [
      {
        name: "record_pain",
        description: "Record the patient's pain score from 0 to 10: before the exercises, during (any pain number given between sets), or after the exercises.",
        parameters: {
          type: "OBJECT",
          properties: {
            when: { type: "STRING", enum: ["before", "during", "after"] },
            score: { type: "INTEGER", description: "0 = no pain, 10 = worst pain" },
          },
          required: ["when", "score"],
        },
      },
      {
        name: "start_set",
        description: "Mark the start of a set of the current exercise when the patient is ready.",
        parameters: { type: "OBJECT", properties: { set: { type: "INTEGER" } }, required: ["set"] },
      },
      {
        name: "log_set",
        description: "Log the number of reps completed in the set that just ended.",
        parameters: {
          type: "OBJECT",
          properties: { set: { type: "INTEGER" }, reps: { type: "INTEGER" } },
          required: ["set", "reps"],
        },
      },
      {
        name: "report_concern",
        description: "Report a safety concern and stop the session.",
        parameters: {
          type: "OBJECT",
          properties: {
            kind: { type: "STRING", enum: [...CONCERNS] },
            details: { type: "STRING", description: "What the patient said, briefly" },
            score: { type: "INTEGER", description: "The pain score 0–10 if the patient gave one" },
          },
          required: ["kind", "details"],
        },
      },
      {
        name: "finish_session",
        description: "Finish the session after the pain score after the exercises.",
        parameters: {
          type: "OBJECT",
          properties: { difficulty: { type: "STRING", enum: ["easy", "ok", "hard"] } },
          required: ["difficulty"],
        },
      },
      {
        name: "save_memory",
        description: "Remember one short fact about the patient for future sessions.",
        parameters: {
          type: "OBJECT",
          properties: {
            kind: { type: "STRING", enum: [...MEMORY_KINDS] },
            text: { type: "STRING", description: "One short sentence" },
          },
          required: ["kind", "text"],
        },
      },
      {
        name: "log_diary",
        description: "Log phantom limb pain, phantom sensation or mood with a 0–10 score. Use a phantom kind only for an answer about the missing part of the amputated limb (leg, foot, arm or hand), never for their pain right now (that is record_pain).",
        parameters: {
          type: "OBJECT",
          properties: {
            kind: { type: "STRING", enum: [...DIARY_KINDS] },
            score: { type: "INTEGER", description: "Pain: 0 none to 10 worst. Mood: 0 very low to 10 very good." },
            note: { type: "STRING", description: "Optional short note in the patient's words" },
          },
          required: ["kind", "score"],
        },
      },
    ],
  },
];

/** What the coach is told about the patient's history at the start of a session. */
export function coachContext(p: Patient) {
  const lines: string[] = [];
  for (const m of p.memories.slice(-15)) lines.push(`- (${m.kind}) ${m.text}`);
  for (const d of p.diary.filter((d) => d.kind !== "mood").slice(-3))
    lines.push(`- ${d.at.slice(0, 10)}: ${d.kind.replace("_", " ")} ${d.score ?? "?"}/10${d.note ? ` (${d.note})` : ""}`);
  for (const r of p.sessions.slice(-2)) {
    const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
    const done = r.exercises.reduce((n, e) => n + e.logged.filter((v) => v !== null).length, 0);
    lines.push(
      `- ${r.at.slice(0, 10)} session: ${done}/${sets} sets, pain ${r.painBefore ?? "?"}→${r.painAfter ?? "?"}${r.difficulty ? `, felt ${r.difficulty}` : ""}${r.concern ? `, stopped for ${r.concern.kind}` : ""}`,
    );
  }
  return lines.length ? lines.join("\n") : "- Nothing yet. This may be the first session.";
}
