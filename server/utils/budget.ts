import type { H3Event } from "h3";
import { FieldValue } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";

// SYS-02: cost guard for every Gemini call. Per IP per hour per task (on top of the per-workspace
// limits), and one global daily count shared by all instances (Firestore) so new anonymous
// visitors cannot reset it.
export type AiTask = "live" | "brief" | "skin" | "talk" | "family" | "proposal" | "triage" | "intake" | "navigator" | "familyTalk";
const PER_IP_HOUR: Record<AiTask, number> = { live: 6, brief: 20, skin: 15, talk: 120, family: 20, proposal: 30, triage: 30, intake: 10, navigator: 20, familyTalk: 120 };
const HOUR = 3_600_000;

export const budgetDay = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

/** Adds one call to today's global count and returns the new total. */
async function countToday(): Promise<number> {
  const day = budgetDay();
  if (useRuntimeConfig().storage === "firestore") {
    const ref = getFirestore(adminApp()).collection("meta").doc(`budget-${day}`);
    await ref.set({ calls: FieldValue.increment(1), day }, { merge: true });
    return ((await ref.get()).data()?.calls as number) ?? 1;
  }
  const store = useStorage("data");
  const n = ((await store.getItem<number>(`budget:${day}`)) ?? 0) + 1;
  await store.setItem(`budget:${day}`, n);
  return n;
}

/** Throws 429 with `data.fallback = true` when a limit is reached; the screen then shows its fixed fallback. */
export async function aiBudget(event: H3Event, task: AiTask) {
  rateLimit(event, "", `ip-${task}`, PER_IP_HOUR[task], HOUR);
  const max = Number(useRuntimeConfig().geminiDailyCalls) || 2000;
  if ((await countToday()) > max) throw createError({ statusCode: 429, statusMessage: "AI limit reached for today.", data: { fallback: true } });
}
