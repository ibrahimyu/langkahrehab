// AI-10: filter of notes the AI writes for the doctor. The model may only quote what the patient
// really said (checked against the transcript), urgency comes from rules, and the same thing said
// again within 7 days is merged into one note with a count ("mentioned 3 times").

import { DAY, type Note } from "./model";

const norm = (s: string) => s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** True when the quote appears in the patient's own words (ignoring case, punctuation and spacing). */
export function quoteFound(quote: string, transcript: string[]): boolean {
  const q = norm(quote);
  if (q.length < 3) return false;
  return transcript.some((t) => norm(t).includes(q));
}

const tokens = (s: string) => {
  const n = norm(s);
  // Chinese has no spaces: compare characters instead of words.
  return new Set(/[一-鿿]/.test(n) ? [...n.replace(/\s/g, "")] : n.split(" ").filter((w) => w.length > 2));
};

/** Word overlap (Jaccard) between two notes' quotes and summaries. */
export function similarity(a: Pick<Note, "quote" | "summary">, b: Pick<Note, "quote" | "summary">): number {
  const x = tokens(`${a.quote} ${a.summary}`);
  const y = tokens(`${b.quote} ${b.summary}`);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

export const SIMILAR = 0.5;

/**
 * Adds notes, merging each into an earlier note of the same kind with similar words from the last
 * 7 days. A merged note counts the mention, keeps the more urgent level and goes back to unread.
 */
export function mergeNotes(existing: Note[], incoming: Note[], now: number): { notes: Note[]; added: Note[]; merged: Note[] } {
  const notes = [...existing];
  const added: Note[] = [];
  const merged: Note[] = [];
  const rank = { normal: 0, watch: 1, now: 2 } as const;
  for (const n of incoming) {
    const twin = [...notes].reverse().find((o) => !o.private && o.kind === n.kind && now - Date.parse(o.lastMentionedAt ?? o.at) < 7 * DAY && similarity(o, n) >= SIMILAR);
    if (twin) {
      twin.mentions = (twin.mentions ?? 1) + 1;
      twin.lastMentionedAt = n.at;
      if (rank[n.urgency] > rank[twin.urgency]) twin.urgency = n.urgency;
      twin.readAt = null;
      twin.readBy = null;
      merged.push(twin);
    } else {
      notes.push(n);
      added.push(n);
    }
  }
  return { notes: notes.slice(-200), added, merged };
}
