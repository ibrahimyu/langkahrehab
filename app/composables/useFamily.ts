import type { FamilyView } from "#shared/family";
import { locale } from "#shared/i18n";

const meKey = (patientId: string) => `langkah-family-member:${patientId}`;

/**
 * The family app's data (KEL-01): one reduced copy of the patient shared by every family screen,
 * and "I am …" (which family member is holding the phone), remembered on this device.
 * Every change returns the new view, so all screens stay in step.
 */
export function useFamily(patientId: string) {
  const api = useApi("family");
  const toast = useToast();
  const T = useT();
  const { account } = useSession();
  const view = useState<FamilyView | null>(`family-view-${patientId}`, () => null);
  const loadError = useState(`family-error-${patientId}`, () => "");
  const memberId = useState<string | null>(`family-me-${patientId}`, () => {
    try {
      return localStorage.getItem(meKey(patientId));
    } catch {
      return null;
    }
  });

  const me = computed(() => {
    const fam = view.value?.family ?? [];
    return fam.find((m) => m.id === memberId.value) ?? fam.find((m) => m.id === account.value?.id) ?? fam[0] ?? null;
  });
  function setMe(id: string) {
    memberId.value = id;
    try {
      localStorage.setItem(meKey(patientId), id);
    } catch {}
  }

  async function load() {
    loadError.value = "";
    try {
      view.value = (await api<{ family: FamilyView }>(`/api/patients/${patientId}`)).family;
    } catch (e) {
      loadError.value = errorMessage(e);
    }
  }

  /** A change; returns true when saved. Errors show as a toast (or are returned with `quiet`). */
  async function send(path: string, method: string, body?: unknown, opts: { quiet?: boolean } = {}): Promise<true | string> {
    try {
      view.value = await api<FamilyView>(`/api/patients/${patientId}/family${path}`, { method, body });
      return true;
    } catch (e: any) {
      const msg = e?.data?.data?.code === "body_task" ? "body_task" : errorMessage(e);
      if (!opts.quiet) toast.show(msg === "body_task" ? T("famBodyTaskNo") : msg, { tone: "bad" });
      return msg;
    }
  }

  const nameOf = (id: string | null) => view.value?.family.find((m) => m.id === id)?.name ?? "";
  return { view, loadError, me, setMe, load, send, nameOf };
}

/** "Thu 23 Oct" in the app language. */
export function useDayText() {
  const lang = useLang();
  return (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale(lang.value), { weekday: "short", day: "numeric", month: "short" });
}
