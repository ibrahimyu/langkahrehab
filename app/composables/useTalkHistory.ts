// The companion chat lives on the phone: the open chat survives leaving the tab or reloading,
// and an ended chat is either kept in a history (newest first) or deleted.

export type SavedTalk<B> = { id: string; startedAt: string; endedAt: string; bubbles: B[] };
type OpenTalk<B> = { startedAt: string; bubbles: B[]; draft: string; crisis: boolean };

const MAX_HISTORY = 30;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function useTalkHistory<B>(patientId: string) {
  const openKey = `langkah-talk-${patientId}`;
  const historyKey = `langkah-talk-history-${patientId}`;
  const history = ref<SavedTalk<B>[]>([]) as Ref<SavedTalk<B>[]>;
  onMounted(() => (history.value = read(historyKey, [])));

  const loadOpen = () => read<OpenTalk<B> | null>(openKey, null);
  const saveOpen = (talk: OpenTalk<B> | null) => write(openKey, talk && (talk.bubbles.length || talk.draft || talk.crisis) ? talk : null);

  function setHistory(list: SavedTalk<B>[]) {
    history.value = list.slice(0, MAX_HISTORY);
    write(historyKey, history.value);
  }
  function keep(talk: SavedTalk<B>) {
    setHistory([talk, ...history.value.filter((t) => t.id !== talk.id)]);
  }
  function remove(id: string) {
    const index = history.value.findIndex((t) => t.id === id);
    const talk = history.value[index];
    setHistory(history.value.filter((t) => t.id !== id));
    return talk ? () => setHistory([...history.value.slice(0, index), talk, ...history.value.slice(index)]) : () => {};
  }

  return { history, loadOpen, saveOpen, keep, remove };
}
