// SYS-05 / BUG-02 / BUG-03: nothing a patient did is lost when the network drops.
// Before sending, the session (and any memory or diary the coach logged) is kept on this phone.
// Each request is removed from the queue only after the server confirms it; the session itself
// carries a clientId, so sending it twice never creates two sessions.

type Request = { path: string; body: Record<string, unknown> };
type Pending = { extras: Request[]; session: Request | null };

const key = (patientId: string) => `langkah-pending:${patientId}`;

function read(patientId: string): Pending {
  try {
    const raw = localStorage.getItem(key(patientId));
    if (raw) return JSON.parse(raw) as Pending;
  } catch {}
  return { extras: [], session: null };
}

function write(patientId: string, p: Pending) {
  try {
    if (!p.extras.length && !p.session) localStorage.removeItem(key(patientId));
    else localStorage.setItem(key(patientId), JSON.stringify(p));
  } catch {}
}

export function usePendingSession(patientId: string) {
  const api = useApi();
  const pendingCount = useState<number>(`pending-${patientId}`, () => {
    const p = read(patientId);
    return p.extras.length + (p.session ? 1 : 0);
  });
  const refresh = () => {
    const p = read(patientId);
    pendingCount.value = p.extras.length + (p.session ? 1 : 0);
  };

  /** Keeps a memory or diary entry that could not be sent, to go out with the next save. */
  function queueExtra(path: string, body: Record<string, unknown>) {
    const p = read(patientId);
    p.extras.push({ path, body });
    write(patientId, p);
    refresh();
  }

  /** Sends everything waiting for this patient. Returns the saved session id, if a session was sent. */
  async function send(session?: Request): Promise<string | null> {
    const p = read(patientId);
    if (session) {
      p.session = session;
      write(patientId, p);
    }
    while (p.extras.length) {
      await api(`/api/patients/${patientId}/${p.extras[0]!.path}`, { method: "POST", body: p.extras[0]!.body });
      p.extras.shift();
      write(patientId, p);
    }
    let id: string | null = null;
    if (p.session) {
      const res = await api<{ session: { id: string } }>(`/api/patients/${patientId}/${p.session.path}`, { method: "POST", body: p.session.body });
      id = res.session.id;
      p.session = null;
      write(patientId, p);
    }
    refresh();
    return id;
  }

  return { pendingCount, queueExtra, send };
}
