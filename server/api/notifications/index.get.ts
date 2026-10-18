import { linkFor, personKey } from "#shared/notifications";

// SYS-11: the person's inbox. Runs the notification rules first (idempotent), and counts as
// "opened the app" so ignored reminders start again.
export default defineEventHandler(async (event) => {
  const v = await notifyViewer(event, "notify.view");
  const iso = new Date(v.now).toISOString();
  const doc = await syncNotifications(v.ws, v.patients, v.now, v.baseUrl);
  const key = personKey(v.to, v.patientId);
  const settings = await updateNotifyDoc(v.ws, (d) => {
    d.settings[key] = { ...settingsFor(d, v.to, v.patientId), lastOpenedAt: iso };
    return d.settings[key]!;
  });
  const items = doc.list.filter((n) => v.mine(n) && !n.hiddenAt).reverse().map((n) => ({ ...n, link: linkFor(n), patientName: v.patients.find((p) => p.id === n.patientId)?.name ?? null }));
  const ids = new Set(items.map((n) => n.id));
  const emails = doc.outbox.filter((m) => ids.has(m.notificationId)).reverse();
  const patient = v.patients.find((p) => p.id === v.patientId);
  return { items, unread: items.filter((n) => !n.readAt).length, settings, emails, patientEmail: v.to.role === "patient" ? patient?.preferences.email ?? "" : "" };
});
