import { TALK_MAX_TURNS, TALK_SESSIONS_PER_DAY, companionSchema, parseCompanion, screenReply, type TalkMessage } from "#shared/companion";
import { exerciseById } from "#shared/exercises";
import { DAY, describeProfile, pickLang, str } from "#shared/model";
import { schedule } from "#shared/planDiff";
import { detectRedFlags } from "#shared/redflags";
import { mergeNotes, quoteFound } from "#shared/noteFilter";
import { notesFor } from "#shared/permissions";
import { routeTalkNote } from "#shared/talkNotes";
import { addAlerts, makeAlert } from "#shared/rules";

// Talk with Langkah (AI-09, PAS-19). The transcript is not stored. The patient is never told the talk
// becomes notes: a question they asked for the doctor is offered for their list of questions; body
// findings and feelings are kept quietly as clinician-only notes (talkNotes.ts); danger signs alert at once.
// Danger words never reach the model: the safety net answers with the fixed crisis screen (SYS-01).
export default defineEventHandler(async (event) => {
  const { ws, id, iso, patient: p } = await patientContext(event);
  assertCan(actorFrom(event), "talk.use");
  const b = (await readBody(event)) ?? {};
  const text = str(b.text, 600);
  if (!text) throw bad("Say or write something first.");
  const lang = pickLang(b.lang ?? p.lang);
  const via = b.via === "voice" ? "voice" : "text";
  const history: TalkMessage[] = (Array.isArray(b.history) ? b.history : [])
    .slice(-TALK_MAX_TURNS)
    .flatMap((m: any): TalkMessage[] => (m && (m.role === "user" || m.role === "model") && str(m.text, 900) ? [{ role: m.role, text: str(m.text, 900) }] : []));
  // ---- Safety net first, independent of the model ----
  const flag = detectRedFlags(text, lang);
  if (flag) {
    const distress = flag.kind === "distress";
    // Distress is about feelings: the doctor sees it (and the alert), the patient's notes never show it.
    const note = buildNote({ kind: distress ? "worry" : "complaint", quote: text, summary: `Said in Talk with Langkah (${flag.kind}).`, urgency: "now", source: "companion", via, at: iso, ...(distress ? { clinicianOnly: true, topic: "wellbeing" as const } : { topic: "body" as const }) });
    const alert = distress
      ? makeAlert("wellbeing", "urgent", `Talk with Langkah: the patient sounded in deep distress. Patient said: "${text}". Please call them today.`, ["doctor", "physio"], iso)
      : makeAlert("red_flag", "high", `Talk with Langkah: possible danger sign (${flag.kind}). Patient said: "${text}".`, ["doctor", "physio"], iso);
    const updated = await updatePatient(ws, id, (q) => {
      q.notes = [...q.notes, note].slice(-200);
      addAlerts(q, [alert]);
    });
    return { mode: distress ? "crisis" : "red_flag", flag: flag.kind, reply: "", notes: notesFor("patient", updated.notes), saved: distress ? [] : [note], proposals: [] };
  }

  // Limits apply only to the model call: the safety net above is never blocked.
  const key = `${ws}:${id}`;
  if (!history.length) rateLimit(event, key, "talk-session", TALK_SESSIONS_PER_DAY, DAY);
  rateLimit(event, key, "talk-turn", 200, DAY);
  await aiBudget(event, "talk");

  // ---- The companion: patient's own context only, never the clinical brief or doctor notes ----
  const last = p.sessions.at(-1);
  const context = {
    name: p.name.split(" ").slice(0, 2).join(" "),
    stage: describeProfile(p.profile),
    goals: p.goals.map((g) => ({ goal: g.text, main: g.main, steps: g.targets.map((t) => ({ text: t.text, done: !!t.doneAt })) })),
    recentNotes: p.notes.filter((n) => !n.private && !n.clinicianOnly).slice(-5).map((n) => ({ kind: n.kind, quote: n.quote, reply: n.reply })),
    lastSession: last ? { at: last.at.slice(0, 10), painAfter: last.painAfter, difficulty: last.difficulty, sessionsTotal: p.sessions.length } : null,
    exerciseTime: p.preferences.exerciseTime,
    // So "how often should I exercise?" gets the physio's answer, not a guess.
    plan: {
      exercises: p.plan.items.map((i) => ({ name: exerciseById(i.exerciseId)?.name[lang] ?? i.exerciseId, sets: i.sets, reps: i.reps })),
      ...schedule(p.plan),
      noteFromPhysio: p.plan.note,
    },
  };
  let raw: any;
  try {
    const response = await gemini().models.generateContent({
      model: useRuntimeConfig().textModel,
      contents: [
        { role: "user", parts: [{ text: `Patient data (JSON):\n${JSON.stringify(context)}` }] },
        { role: "model", parts: [{ text: '{"reply":"OK","notes":[],"proposals":[]}' }] },
        ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: "user", parts: [{ text }] },
      ],
      config: {
        systemInstruction: companionInstruction(lang, !history.length),
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: companionSchema as never,
        abortSignal: AbortSignal.timeout(30_000),
      },
    });
    raw = JSON.parse(response.text ?? "{}");
  } catch (e) {
    throw providerError(e, "Talk failed");
  }
  const turn = parseCompanion(raw);
  // Rules on the reply: a reply that breaks a hard limit is replaced by fixed text on the screen.
  const issue = screenReply(turn.reply);
  // AI-10: a quote must be the patient's own words from this conversation. Rules then decide where
  // each one goes: an explicit body question is offered to the patient; the rest is kept quietly.
  const said = [text, ...history.filter((m) => m.role === "user").map((m) => m.text)];
  const offers: { kind: "question" | "request"; quote: string; summary: string }[] = [];
  const quiet: ReturnType<typeof buildNote>[] = [];
  for (const n of turn.notes.filter((n) => quoteFound(n.quote, said))) {
    const r = routeTalkNote(n);
    if (r.route === "question") offers.push({ kind: r.kind, quote: n.quote, summary: n.summary });
    else if (r.route === "clinician")
      quiet.push(buildNote({ kind: r.kind, quote: n.quote, summary: n.summary, urgency: r.kind === "complaint" || r.kind === "worry" ? "watch" : "normal", source: "companion", via, at: iso, clinicianOnly: true, topic: r.topic }));
  }
  if ((issue === "medicine" || issue === "diagnosis") && !offers.length) offers.push({ kind: "question", quote: text, summary: "Asked in Talk with Langkah; needs a clinician's answer." });
  let notes = p.notes;
  if (quiet.length)
    notes = (await updatePatient(ws, id, (q) => void (q.notes = mergeNotes(q.notes, quiet, Date.parse(iso)).notes.slice(-200)))).notes;
  return { mode: "reply", flag: null, reply: issue ? "" : turn.reply || "…", safeKey: issue, notes: notesFor("patient", notes), saved: [], offers, proposals: turn.proposals, card: issue ? null : turn.card };
});
