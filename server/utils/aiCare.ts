import type { H3Event } from "h3";
import { LANGS } from "#shared/exercises";
import { TRIAGE_ACTIONS, type Evidence, type Patient, type Text3, type TriageAction } from "#shared/model";
import { changeText, type ProgressionResult } from "#shared/progression";

// AI helpers for the care team (AI-05 proposal reason, AI-06 morning triage). The rules have already
// decided everything that matters; the model only writes sentences. Each returns null when the key is
// missing, a limit is hit or the reply is unusable, and the caller uses its template instead.

const text3Schema = { type: "object", properties: { en: { type: "string" }, id: { type: "string" }, zh: { type: "string" } }, required: ["en", "id", "zh"] };

async function ask(event: H3Event, task: "proposal" | "triage", system: string, user: string, schema: object): Promise<any | null> {
  try {
    if (!useRuntimeConfig().geminiApiKey) return null;
    await aiBudget(event, task);
    const r = await gemini().models.generateContent({
      model: useRuntimeConfig().textModel,
      contents: [{ role: "user", parts: [{ text: user }] }],
      config: { systemInstruction: system, temperature: 0.3, maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema: schema as never, abortSignal: AbortSignal.timeout(15_000) },
    });
    return JSON.parse(r.text ?? "null");
  } catch (e: any) {
    if (e?.statusCode !== 429 && e?.statusCode !== 503) console.error(`AI ${task} failed`, e?.message ?? e);
    return null;
  }
}

const words = (s: string, max: number) => s.trim().split(/\s+/).slice(0, max).join(" ");
/** Rejects text that would break the rules: medicine, diagnosis words, or a new number for the dose. */
const unsafe = (s: string) => /\b(mg|tablet|pill|obat|药|diagnos|ibuprofen|paracetamol)/i.test(s);

/** AI-05: why the rules suggest this step, in three languages (≤ 50 words each), with evidence ids from the input. */
export async function proposalRationale(event: H3Event, p: Patient, r: ProgressionResult): Promise<{ rationale: Text3; evidence: Evidence[] } | null> {
  const recent = p.sessions.slice(-7).map((s) => ({ id: s.id, date: s.at.slice(0, 10), pain: `${s.painBefore ?? "?"}→${s.painAfter ?? "?"}`, felt: s.difficulty, reps: s.exercises.map((e) => `${e.logged.filter((v) => v !== null).join("+")} of ${e.sets}x${e.reps}`).join("; ") }));
  const input = {
    changes: r.changes.map((c) => changeText("en", c)),
    rulesPassed: r.eligibility.map((e) => `${e.rule}: ${e.value}`),
    sessions: recent,
    personalGoals: p.goals.filter((g) => g.main).map((g) => g.text).slice(0, 2),
  };
  const system = `You explain to a physiotherapist why a rule-based check suggests a small exercise dose step for a rehab patient after a leg amputation.
Use only the data given. Do not add, remove or change any dose change; repeat it exactly as given. Never name a diagnosis or a medicine. Write as a suggestion ("could move to 12 reps"), not a decision.
Return "rationale" in English (en), Indonesian (id) and Simplified Chinese (zh), each at most 50 words, and "evidence": the ids of up to 4 sessions you relied on.`;
  const schema = { type: "object", properties: { rationale: text3Schema, evidence: { type: "array", items: { type: "string" } } }, required: ["rationale", "evidence"] };
  const raw = await ask(event, "proposal", system, JSON.stringify(input), schema);
  if (!raw?.rationale) return null;
  const rationale = {} as Text3;
  for (const l of LANGS) {
    const s = words(String(raw.rationale[l] ?? ""), 50);
    if (!s || unsafe(s)) return null;
    rationale[l] = s;
  }
  const known = new Map(r.evidence.map((e) => [e.id, e]));
  const evidence = (Array.isArray(raw.evidence) ? raw.evidence : []).map((id: unknown) => known.get(String(id))).filter((e: Evidence | undefined): e is Evidence => !!e).slice(0, 4);
  return { rationale, evidence: evidence.length ? evidence : r.evidence.slice(-3) };
}

export type TriageCandidate = { patientId: string; name: string; tier: number; reasons: string[] };

/**
 * AI-06: one short sentence per patient. The tiers come from the rules and never move: the model's
 * order is used only inside a tier. Unknown ids and actions outside the list are dropped.
 */
export async function triageSentences(event: H3Event, lang: string, candidates: TriageCandidate[]): Promise<{ patientId: string; reason: string; action: TriageAction }[] | null> {
  if (!candidates.length) return [];
  const system = `You help a rehab care team plan their morning. You get patients already sorted by rules, each with raw reasons.
For each patient write one plain sentence (at most 20 words) saying why they need attention today, in ${lang === "zh" ? "Simplified Chinese" : lang === "id" ? "Indonesian" : "English"}, and pick one suggested action from the list. Use only the reasons given. No diagnosis, no medicine, no new facts.`;
  const schema = {
    type: "object",
    properties: { items: { type: "array", items: { type: "object", properties: { patientId: { type: "string" }, reason: { type: "string" }, suggestedAction: { type: "string", enum: [...TRIAGE_ACTIONS] } }, required: ["patientId", "reason", "suggestedAction"] } } },
    required: ["items"],
  };
  const raw = await ask(event, "triage", system, JSON.stringify(candidates.map(({ patientId, name, tier, reasons }) => ({ patientId, name: name.split(" ").slice(0, 2).join(" "), tier, reasons }))), schema);
  if (!Array.isArray(raw?.items)) return null;
  const tierOf = new Map(candidates.map((c) => [c.patientId, c.tier]));
  const seen = new Set<string>();
  const out: { patientId: string; reason: string; action: TriageAction; order: number }[] = [];
  raw.items.forEach((it: any, order: number) => {
    const id = String(it?.patientId ?? "");
    const reason = words(String(it?.reason ?? ""), 20);
    if (!tierOf.has(id) || seen.has(id) || !reason || unsafe(reason)) return;
    seen.add(id);
    out.push({ patientId: id, reason, action: (TRIAGE_ACTIONS as readonly string[]).includes(it?.suggestedAction) ? it.suggestedAction : "no_action", order });
  });
  // Tier from the rules first, the model's order only inside a tier.
  return out.sort((a, b) => tierOf.get(a.patientId)! - tierOf.get(b.patientId)! || a.order - b.order).map(({ order, ...x }) => x);
}
