import { cleanSettings, isEmailValid, personKey, type NotifySettings } from "#shared/notifications";

// SYS-11: the person's own channels, email address and quiet hours.
export default defineEventHandler(async (event) => {
  const v = await notifyViewer(event, "notify.settings");
  const body = (await readBody<Partial<NotifySettings>>(event)) ?? {};
  if (typeof body.email === "string" && body.email.trim() && !isEmailValid(body.email)) throw createError({ statusCode: 400, statusMessage: "That email address does not look right." });
  const key = personKey(v.to, v.patientId);
  return updateNotifyDoc(v.ws, (d) => {
    d.settings[key] = cleanSettings(body, settingsFor(d, v.to, v.patientId));
    return d.settings[key]!;
  });
});
