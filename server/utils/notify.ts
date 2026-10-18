import type { H3Event } from "h3";
import { getFirestore } from "firebase-admin/firestore";
import { looksAfter } from "#shared/accounts";
import { t, type TextKey } from "#shared/i18n";
import type { Lang } from "#shared/exercises";
import { newId, type Patient } from "#shared/model";
import {
  addNotifications,
  dailyDigests,
  defaultNotifySettings,
  eventNotifications,
  isFor,
  linkFor,
  patientReminders,
  personKey,
  type Notification,
  type NotifySettings,
  type NotifyTo,
} from "#shared/notifications";

// SYS-11 storage: one document per workspace (workspaces/{ws}/meta/notify; locally ws:{ws}:notify),
// because clinicians get notifications across patients (urgent alerts, the morning digest).

export type MailMessage = {
  id: string;
  at: string;
  to: string;
  lang: Lang;
  subject: string;
  text: string;
  button: string;
  link: string;
  notificationId: string;
  provider: string;
};
export type NotifyDoc = { settings: Record<string, NotifySettings>; list: Notification[]; outbox: MailMessage[] };
const OUTBOX_MAX = 50;

/**
 * Where email goes. Only the dev sink exists: it keeps the message in the workspace (the "Email preview"
 * screen reads it) and logs one line. A real provider (e.g. SendGrid or Firebase "Trigger Email")
 * implements the same `send` once it is chosen; nothing else changes.
 */
export interface MailProvider {
  name: string;
  send(doc: NotifyDoc, m: MailMessage): Promise<void>;
}
export const devMailSink: MailProvider = {
  name: "dev-sink",
  async send(doc, m) {
    doc.outbox.push(m);
    if (doc.outbox.length > OUTBOX_MAX) doc.outbox.splice(0, doc.outbox.length - OUTBOX_MAX);
    if (process.env.NODE_ENV !== "test") console.info(`[mail:dev-sink] to=${m.to} subject="${m.subject}" (not sent)`);
  },
};
export const mailProvider = (): MailProvider => devMailSink;

const useFirestore = () => useRuntimeConfig().storage === "firestore";
const notifyRef = (ws: string) => getFirestore(adminApp()).collection("workspaces").doc(ws).collection("meta").doc("notify");
const empty = (): NotifyDoc => ({ settings: {}, list: [], outbox: [] });

export async function getNotifyDoc(ws: string): Promise<NotifyDoc> {
  const d = useFirestore() ? ((await notifyRef(ws).get()).data() as NotifyDoc | undefined) : await useStorage("data").getItem<NotifyDoc>(`ws:${ws}:notify`);
  return { ...empty(), ...(d ?? {}) };
}

export async function updateNotifyDoc<T>(ws: string, change: (d: NotifyDoc) => T | Promise<T>): Promise<T> {
  if (useFirestore()) {
    const db = getFirestore(adminApp());
    return db.runTransaction(async (tx) => {
      const ref = notifyRef(ws);
      const d = { ...empty(), ...((await tx.get(ref)).data() as NotifyDoc | undefined) };
      const out = await change(d);
      tx.set(ref, d);
      return out;
    });
  }
  const d = await getNotifyDoc(ws);
  const out = await change(d);
  await useStorage("data").setItem(`ws:${ws}:notify`, d);
  return out;
}

export const settingsFor = (d: NotifyDoc, to: NotifyTo, patientId: string | null): NotifySettings => ({ ...defaultNotifySettings(), ...(d.settings[personKey(to, patientId)] ?? {}) });

/** The recipient's email address and language (the patient's email can also come from Me). */
function recipient(d: NotifyDoc, n: Notification, patients: Patient[]): { email: string; lang: Lang } {
  const s = settingsFor(d, n.to, n.patientId);
  const p = patients.find((x) => x.id === n.patientId);
  if (n.to.role === "patient") return { email: s.email || p?.preferences.email || "", lang: p?.lang ?? "en" };
  if (n.to.role === "family") return { email: s.email, lang: p?.family.find((f) => f.id === n.to.familyMemberId)?.lang ?? p?.lang ?? "en" };
  return { email: s.email, lang: "en" };
}

/** The email for a notification. Only the summary words from i18n: never pain numbers, diary text or quotes. */
export function renderEmail(n: Notification, lang: Lang, to: string, baseUrl: string): MailMessage {
  const params = { ...n.params };
  return {
    id: newId(),
    at: n.at,
    to,
    lang,
    subject: t(lang, `ntf_${n.kind}` as TextKey, params),
    text: t(lang, `ntf_${n.kind}_body` as TextKey, params),
    button: t(lang, "ntfOpen"),
    link: `${baseUrl}${linkFor(n)}`,
    notificationId: n.id,
    provider: mailProvider().name,
  };
}

/**
 * Runs the notification rules for every patient (idempotent by key), sends email for the new ones that
 * have the email channel, and returns the stored document.
 */
export async function syncNotifications(ws: string, patients: Patient[], now: number, baseUrl: string): Promise<NotifyDoc> {
  return updateNotifyDoc(ws, async (d) => {
    const settingsOf = (to: NotifyTo, pid: string | null) => {
      const s = settingsFor(d, to, pid);
      const p = to.role === "patient" ? patients.find((x) => x.id === pid) : undefined;
      return p && !s.email && p.preferences.email ? { ...s, email: p.preferences.email } : s;
    };
    const drafts = [
      ...patients.flatMap((p) => [...patientReminders(p, settingsOf({ role: "patient" }, p.id), d.list, now), ...eventNotifications(p, d.list, now)]),
      ...dailyDigests(patients, now),
    ];
    const added = addNotifications(d.list, drafts, settingsOf, now, newId);
    for (const n of added) {
      if (!n.channels.includes("email")) continue;
      const r = recipient(d, n, patients);
      if (r.email) await mailProvider().send(d, renderEmail(n, r.lang, r.email, baseUrl));
    }
    return d;
  });
}

/** The person asking (role from the header; patient and family need ?patientId, family also the member). */
export async function notifyViewer(event: H3Event, action: "notify.view" | "notify.settings") {
  const c = await context(event);
  const actor = actorFrom(event);
  assertCan(actor, action);
  const q = getQuery(event);
  const patientId = typeof q.patientId === "string" && q.patientId ? q.patientId : null;
  let to: NotifyTo = { role: actor.role, accountId: actor.accountId };
  const patients = await listPatients(c.ws);
  if (actor.role === "patient" || actor.role === "family") {
    const p = patients.find((x) => x.id === patientId);
    if (!p) throw createError({ statusCode: 404, statusMessage: "Patient not found." });
    if (actor.role === "family") {
      const wanted = (typeof q.memberId === "string" && q.memberId) || actor.accountId;
      const member = p.family.find((f) => f.id === wanted) ?? p.family[0];
      if (!member) throw createError({ statusCode: 404, statusMessage: "No family member yet." });
      to = { role: "family", familyMemberId: member.id };
    } else to = { role: "patient" };
  }
  // Clinicians see notifications about the patients they look after.
  const mine = (n: Notification) => isFor(n, to, patientId) && (!n.patientId || to.role === "patient" || to.role === "family" || looksAfter(actor.accountId, actor.role, patients.find((p) => p.id === n.patientId) ?? {}));
  const baseUrl = getRequestURL(event).origin;
  return { ...c, actor, to, patientId, patients, mine, baseUrl };
}
