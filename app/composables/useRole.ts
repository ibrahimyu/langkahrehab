import { homeFor, seedAccounts, type Account } from "#shared/accounts";
import { ROLES, type Role } from "#shared/model";

const SESSION_KEY = "langkah-session";
const ACCOUNTS_KEY = "langkah-accounts";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
/** Older sessions saved only the account id. */
function readSaved(): Account | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    if (raw.startsWith("{")) return JSON.parse(raw) as Account;
    return seedAccounts().find((a) => a.id === raw) ?? null;
  } catch {
    return null;
  }
}

/** The workspace's accounts (sign-in screen and admin), cached on the phone for a fast first paint. */
export function useAccounts() {
  const list = useState<Account[]>("accounts", () => readJson<Account[]>(ACCOUNTS_KEY) ?? seedAccounts());
  const api = useApi();
  async function load() {
    try {
      list.value = (await api<{ accounts: Account[] }>("/api/accounts")).accounts;
      writeJson(ACCOUNTS_KEY, list.value);
    } catch {}
    return list.value;
  }
  return { list, load };
}

/**
 * The signed-in account (sign-in screen at "/signin"). The app is a client-only SPA, so the saved
 * account is read once at start-up, before route middleware runs.
 */
export function useSession() {
  const account = useState<Account | null>("session-account", () => readSaved());

  function signIn(a: Account, to?: string) {
    account.value = a;
    useState<Role>("role").value = a.role;
    writeJson(SESSION_KEY, a);
    return navigateTo(to ?? homeFor(a));
  }

  function signOut() {
    account.value = null;
    writeJson(SESSION_KEY, null);
    return navigateTo("/signin");
  }

  return { account, signIn, signOut };
}

/** The role the screens act as: the signed-in account's role (patient when nobody is signed in). */
export function useRole() {
  return useState<Role>("role", () => {
    const a = readSaved();
    return a && (ROLES as readonly string[]).includes(a.role) ? a.role : "patient";
  });
}
