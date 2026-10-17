import { TALK_MAX_TURNS, screenReply, type TalkMessage } from "#shared/companion";
import { familyView, textOf } from "#shared/family";
import { DAY, pickLang, str } from "#shared/model";
import { detectRedFlags } from "#shared/redflags";
import { addAlerts, makeAlert } from "#shared/rules";

const ACTIONS = ["none", "tasks", "questions", "members", "help"] as const;
type Action = (typeof ACTIONS)[number];

// The family's companion: support for the caregiver and one next step in the app. The transcript is
// not stored. A danger sign about the patient goes to the care team; deep distress of the family
// member gets the fixed crisis screen. Neither reaches the model.
export default defineEventHandler(async (event) => {
  const { ws, id, now, iso, patient: p } = await patientContext(event);
  assertCan(actorFrom(event), "familyTalk.use");
  const b = (await readBody(event)) ?? {};
  const text = str(b.text, 600);
  if (!text) throw bad("Say or write something first.");
  const lang = pickLang(b.lang ?? p.lang);
  const member = p.family.find((m) => m.id === b.memberId) ?? null;
  const history: TalkMessage[] = (Array.isArray(b.history) ? b.history : [])
    .slice(-TALK_MAX_TURNS)
    .flatMap((m: any): TalkMessage[] => (m && (m.role === "user" || m.role === "model") && str(m.text, 900) ? [{ role: m.role, text: str(m.text, 900) }] : []));

  const flag = detectRedFlags(text, lang);
  if (flag?.kind === "distress") return { mode: "crisis", reply: "", action: "none", question: "" };
  if (flag) {
    const alert = makeAlert("red_flag", "high", `Family (${member?.name ?? "a family member"}) reported a possible danger sign (${flag.kind}): "${text}".`, ["doctor", "physio"], iso);
    await updatePatient(ws, id, (q) => addAlerts(q, [alert]));
    return { mode: "red_flag", reply: "", action: "help", question: "" };
  }

  const key = `${ws}:${id}:${member?.id ?? "family"}`;
  rateLimit(event, key, "family-talk", 200, DAY);
  await aiBudget(event, "familyTalk");

  // Only what the family already sees in their app: no clinical notes, no diary, no alerts.
  const v = familyView(p, now);
  const context = {
    patient: v.name.split(" ").slice(0, 2).join(" "),
    talkingTo: member ? { name: member.name, relation: member.relation, livesWithPatient: member.livesWithPatient } : null,
    today: v.today,
    week: v.week,
    nextVisit: v.nextVisit,
    goal: v.goal?.text ?? null,
    myOpenTasks: v.tasks.filter((t) => t.status === "open" && t.assigneeId === member?.id).map((t) => textOf(t.title, lang)).slice(0, 6),
    familySize: v.family.length,
  };
  let raw: any;
  try {
    const response = await gemini().models.generateContent({
      model: useRuntimeConfig().textModel,
      contents: [
        { role: "user", parts: [{ text: `Family data (JSON):\n${JSON.stringify(context)}` }] },
        { role: "model", parts: [{ text: '{"reply":"OK","action":"none"}' }] },
        ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: "user", parts: [{ text }] },
      ],
      config: {
        systemInstruction: familyCompanionInstruction(lang),
        temperature: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: familyCompanionSchema as never,
        abortSignal: AbortSignal.timeout(30_000),
      },
    });
    raw = JSON.parse(response.text ?? "{}");
  } catch (e) {
    throw providerError(e, "Talk failed");
  }
  const reply = str(raw?.reply, 900);
  const issue = screenReply(reply);
  const action: Action = ACTIONS.includes(raw?.action) ? raw.action : "none";
  return { mode: "reply", reply: issue ? "" : reply || "…", safeKey: issue, action, question: str(raw?.question, 300) };
});
