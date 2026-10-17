import type { H3Event } from "h3";

const buckets = new Map<string, { start: number; count: number }>();

/** Counts one hit in a fixed window; false when the window is already full. Pure, for tests. */
export function hitBucket(store: Map<string, { start: number; count: number }>, id: string, max: number, windowMs: number, now: number) {
  const b = store.get(id);
  if (!b || now - b.start > windowMs) {
    store.set(id, { start: now, count: 1 });
    return true;
  }
  return ++b.count <= max;
}

/** In-memory limit per workspace (or IP when `key` is empty), to keep AI costs bounded during public evaluation. */
export function rateLimit(event: H3Event, key: string, name: string, max: number, windowMs: number) {
  const id = `${name}:${key || getRequestIP(event, { xForwardedFor: true }) || "unknown"}`;
  if (!hitBucket(buckets, id, max, windowMs, Date.now())) throw createError({ statusCode: 429, statusMessage: "Too many requests. Please wait a few minutes." });
}

export const bad = (message: string) => createError({ statusCode: 400, statusMessage: message });
