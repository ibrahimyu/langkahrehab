import type { NoteKind } from "./model";

// What a Talk with Langkah conversation keeps (PAS-19). The patient is never told that the chat
// becomes notes. Only an explicit question about the body goes to "My questions for the doctor";
// body findings and feelings become notes the clinicians read, never shown back to the patient.
// Danger signs are handled before this, by the safety net (redflags.ts).

export const TALK_TOPICS = ["body", "wellbeing", "other"] as const;
export type TalkTopic = (typeof TALK_TOPICS)[number];

/** What the model suggests keeping from one turn. */
export type TalkNoteDraft = { kind: NoteKind; quote: string; summary: string; topic?: TalkTopic; asked?: boolean };

/**
 * question: the patient asked for it to go to the doctor; saved as one of their questions (they see it).
 * clinician: a quiet note for the doctor and physio only.
 * drop: nothing to keep.
 */
export type TalkNoteRoute =
  | { route: "question"; kind: "question" | "request"; topic: "body" | "wellbeing" }
  | { route: "clinician"; kind: NoteKind; topic: "body" | "wellbeing" }
  | { route: "drop" };

const EMOTION =
  /\b(sad|sadness|depressed|down|lonely|alone|afraid|scared|fear|anxious|anxiety|worr(y|ied|ies)|stress(ed)?|hopeless|ashamed|embarrass\w*|angry|cry|crying|cried|useless|burden|give up|tired of)\b|\b(sedih|kesepian|sendirian|takut|cemas|khawatir|was-was|stres|tertekan|putus asa|malu|marah|menangis|nangis|tidak berguna|beban|menyerah|galau|minder|bingung)\b|难过|伤心|孤独|害怕|担心|焦虑|压力|绝望|丢脸|生气|哭|没用|负担|放弃/i;
const BODY =
  /\b(pain|hurts?|hurting|ache|aching|sore|stump|residual limb|phantom|wound|stitch\w*|scar|swell\w*|swollen|bleed\w*|red(ness)?|itch\w*|skin|blister|fell|fall(ing)?|balance|sleep|asleep|awake|numb|cramp\w*|socket|prosthe\w*|exercis\w*|medicine|medication|pill|dose|leg|knee|hip|wheelchair|crutch\w*|walker)\b|\b(nyeri|sakit|ngilu|puntung|bekas amputasi|phantom|luka|jahitan|bengkak|berdarah|merah|gatal|kulit|lecet|jatuh|keseimbangan|tidur|kebas|kram|soket|prostesis|kaki palsu|latihan|obat|dosis|kaki|lutut|pinggul|kursi roda|kruk|tongkat)\b|疼|痛|残肢|幻肢|伤口|缝线|肿|出血|发红|痒|皮肤|摔|平衡|睡|麻|抽筋|假肢|锻炼|药|腿|膝|轮椅|拐杖/i;

/** Kinds that can be a finding about the body even when the patient did not ask anything. */
const FINDING: NoteKind[] = ["complaint", "need", "worry", "life_event"];

/** Decides where one thing from a talk goes. Rules, not the model, have the last word. */
export function routeTalkNote(n: Pick<TalkNoteDraft, "kind" | "quote" | "summary" | "topic" | "asked">): TalkNoteRoute {
  const text = `${n.quote} ${n.summary}`;
  const feeling = n.topic === "wellbeing" || (n.topic !== "body" && EMOTION.test(text));
  const body = n.topic === "body" || (n.topic !== "wellbeing" && BODY.test(text));
  // The patient asked for this to go to the doctor: it becomes their own question, so they see the reply.
  // That holds for feelings too; only what they did not ask to pass on stays a private note.
  if (n.asked && (n.kind === "question" || n.kind === "request" || n.kind === "need"))
    return { route: "question", kind: n.kind === "question" ? "question" : "request", topic: feeling && !body ? "wellbeing" : "body" };
  // Feelings, worries, family stress: for the doctor to keep an eye on, never a question.
  if (feeling) return { route: "clinician", kind: "worry", topic: "wellbeing" };
  // A finding about the body (pain, phantom pain, wound, a fall, sleep lost to pain).
  if (body && FINDING.includes(n.kind)) return { route: "clinician", kind: n.kind === "worry" || n.kind === "life_event" ? "complaint" : n.kind, topic: "body" };
  return { route: "drop" };
}
