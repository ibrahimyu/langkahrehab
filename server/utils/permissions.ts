import type { H3Event } from "h3";
import { ROLES, type Role } from "#shared/model";
import { can, type Action } from "#shared/permissions";

export type Actor = { role: Role };

/**
 * The role a request acts as. In the demo one visitor holds every role and a guided scenario shows
 * two at once (patient phone + physio dashboard), so each screen sends its own role in a header.
 * The workspace (anonymous Firebase user) is still the security boundary between visitors.
 * Real accounts would read the role from a membership document instead (FRD 01, ROL-08).
 */
export function actorFrom(event: H3Event): Actor {
  const raw = getHeader(event, "x-langkah-role") ?? "patient";
  if (!(ROLES as readonly string[]).includes(raw)) throw createError({ statusCode: 400, statusMessage: "Unknown role." });
  return { role: raw as Role };
}

/** Throws 403 unless the actor may perform the action (shared/permissions.ts). */
export function assertCan(actor: Actor, action: Action, ctx?: Parameters<typeof can>[2]) {
  if (!can(actor.role, action, ctx)) throw createError({ statusCode: 403, statusMessage: "forbidden", data: { action, role: actor.role } });
}
