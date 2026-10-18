// SYS-11: mark one notification read/unread, remove it from the inbox, or bring it back (Undo).
export default defineEventHandler(async (event) => {
  const v = await notifyViewer(event, "notify.view");
  const body = await readBody<{ read?: boolean; hidden?: boolean }>(event);
  const nid = getRouterParam(event, "nid") ?? "";
  const iso = new Date(v.now).toISOString();
  return updateNotifyDoc(v.ws, (d) => {
    const n = d.list.find((x) => x.id === nid && v.mine(x));
    if (!n) throw createError({ statusCode: 404, statusMessage: "Notification not found." });
    if (typeof body?.read === "boolean") n.readAt = body.read ? n.readAt ?? iso : null;
    if (typeof body?.hidden === "boolean") n.hiddenAt = body.hidden ? iso : null;
    return { id: n.id, readAt: n.readAt, hiddenAt: n.hiddenAt ?? null };
  });
});
