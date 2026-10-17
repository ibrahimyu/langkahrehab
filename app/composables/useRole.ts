import { accountById, homeFor, type DemoAccount } from "#shared/accounts";
import { ROLES, type Role } from "#shared/model";

const SESSION_KEY = "langkah-session";

function readSaved(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * The signed-in demo account (sign-in screen at "/"). The app is a client-only SPA, so the saved
 * account is read once at start-up, before route middleware runs.
 */
export function useSession() {
  const accountId = useState<string | null>("session-account", () => readSaved());
  const account = computed<DemoAccount | null>(() => (accountId.value ? accountById(accountId.value) ?? null : null));

  function signIn(a: DemoAccount, to?: string) {
    accountId.value = a.id;
    useState<Role>("role").value = a.role;
    try {
      localStorage.setItem(SESSION_KEY, a.id);
    } catch {}
    return navigateTo(to ?? homeFor(a));
  }

  function signOut() {
    accountId.value = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
    return navigateTo("/");
  }

  return { account, signIn, signOut };
}

/** The role the screens act as: the signed-in account's role (patient when nobody is signed in). */
export function useRole() {
  const role = useState<Role>("role", () => {
    const a = accountById(readSaved() ?? "");
    return a && (ROLES as readonly string[]).includes(a.role) ? a.role : "patient";
  });
  return role;
}

/** The demo clock, shared by the header and pages. */
export function useDemoClock() {
  const now = useState<number | null>("demo-now", () => null);
  const day = useState<number>("demo-day", () => 0);
  return { now, day };
}
