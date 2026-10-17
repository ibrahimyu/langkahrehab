import type { Role } from "#shared/model";

const WORKSPACE_KEY = "langkah-workspace";

function localWorkspace() {
  try {
    let id = localStorage.getItem(WORKSPACE_KEY);
    if (!id) localStorage.setItem(WORKSPACE_KEY, (id = crypto.randomUUID()));
    return id;
  } catch {
    return (globalThis as any).__langkahWorkspace ??= crypto.randomUUID();
  }
}

// Untyped $fetch: Nitro's typed routes are too deep to infer for a string path.
const plainFetch = $fetch as unknown as (url: string, options: Record<string, unknown>) => Promise<unknown>;

/** $fetch with the visitor's demo workspace attached (Firebase ID token, or a local id). */
/**
 * `role`: the role this screen acts as (sent as x-langkah-role; the server checks every change against
 * it, see shared/permissions.ts). Defaults to the signed-in account's role.
 */
export function useApi(role?: MaybeRefOrGetter<Role>) {
  const { $idToken } = useNuxtApp();
  const current = useRole();
  return async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const token = await $idToken();
    const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : { "x-workspace": localWorkspace() };
    headers["x-langkah-role"] = toValue(role) ?? current.value;
    return (await plainFetch(path, { method: options.method, body: options.body, headers })) as T;
  };
}

/** Readable message from a failed request. */
export const errorMessage = (e: any, fallback = "Something went wrong.") =>
  e?.data?.statusMessage || e?.statusMessage || e?.message || fallback;
