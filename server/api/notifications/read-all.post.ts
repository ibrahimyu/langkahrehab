// SYS-11: "Mark all as read". Returns the ids it changed, so the screen can undo.
export default defineEventHandler(async (event) => {
  const v = await notifyViewer(event, "notify.view");
  const body = await readBody<{ undo?: string[] } | null>(event);
  const iso = new Date(v.now).toISOString();
  return updateNotifyDoc(v.ws, (d) => {
    const mine = d.list.filter((n) => v.mine(n) && !n.hiddenAt);
    if (Array.isArray(body?.undo)) {
      for (const n of mine) if (body!.undo!.includes(n.id)) n.readAt = null;
      return { ids: body!.undo! };
    }
    const changed = mine.filter((n) => !n.readAt);
    for (const n of changed) n.readAt = iso;
    return { ids: changed.map((n) => n.id) };
  });
});
