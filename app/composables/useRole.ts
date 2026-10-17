import { accountById, homeFor, type Account } from "#shared/accounts";
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
 * The signed-in account (sign-in screen at "/signin"). The app is a client-only SPA, so the saved
 * account is read once at start-up, before route middleware runs.
 */
export function useSession() {
  const accountId = useState<string | null>("session-account", () => readSaved());
  const account = computed<Account | null>(() => (accountId.value ? accountById(accountId.value) ?? null : null));

  function signIn(a: Account, to?: string) {
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
    return navigateTo("/signin");
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
