import { TALK_MAX_TURNS, TALK_SESSIONS_PER_DAY, companionSchema, parseCompanion, screenReply, type TalkMessage } from "#shared/companion";
import { DAY, describeProfile, pickLang, str } from "#shared/model";
import { detectRedFlags } from "#shared/redflags";
import { quoteFound } from "#shared/noteFilter";
import { addAlerts, makeAlert } from "#shared/rules";

// Talk with Langkah (AI-09, PAS-19). The transcript is not stored. Nothing the patient says goes to
// the care team unless they confirm it on the screen; only danger signs are passed on at once.
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
    const note = buildNote({ kind: distress ? "worry" : "complaint", quote: text, summary: `Said in Talk with Langkah (${flag.kind}).`, urgency: "now", source: "companion", via, at: iso });
    const alert = distress
      ? makeAlert("wellbeing", "urgent", `Talk with Langkah: the patient sounded in deep distress. Patient said: "${text}". Please call them today.`, ["doctor", "physio"], iso)
      : makeAlert("red_flag", "high", `Talk with Langkah: possible danger sign (${flag.kind}). Patient said: "${text}".`, ["doctor", "physio"], iso);
    const updated = await updatePatient(ws, id, (q) => {
      q.notes = [...q.notes, note].slice(-200);
      addAlerts(q, [alert]);
    });
    return { mode: distress ? "crisis" : "red_flag", flag: flag.kind, reply: "", notes: updated.notes, saved: [note], proposals: [] };
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
    recentNotes: p.notes.filter((n) => !n.private).slice(-5).map((n) => ({ kind: n.kind, quote: n.quote, reply: n.reply })),
    lastSession: last ? { at: last.at.slice(0, 10), painAfter: last.painAfter, difficulty: last.difficulty, sessionsTotal: p.sessions.length } : null,
    exerciseTime: p.preferences.exerciseTime,
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
  // AI-10: a quote must be the patient's own words from this conversation. These are offers only:
  // the patient decides on the screen whether each one goes to the care team.
  const said = [text, ...history.filter((m) => m.role === "user").map((m) => m.text)];
  const offers = turn.notes.filter((n) => quoteFound(n.quote, said));
  if (issue === "medicine" || issue === "diagnosis") offers.push({ kind: "question", quote: text, summary: "Asked in Talk with Langkah; needs a clinician's answer." });
  return { mode: "reply", flag: null, reply: issue ? "" : turn.reply || "…", safeKey: issue, notes: p.notes, saved: [], offers, proposals: turn.proposals, card: issue ? null : turn.card };
});
