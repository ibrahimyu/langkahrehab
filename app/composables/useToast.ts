// One toast at a time, called from anywhere (Sonner pattern from the kit). Undo instead of
// "Are you sure?" dialogs (DESIGN §0, rule 7). The timer pauses while the tab is hidden.
export type ToastItem = { id: number; text: string; undo?: () => void | Promise<void>; tone?: "good" | "bad" };

export function useToast() {
  const current = useState<ToastItem | null>("toast", () => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function show(text: string, opts: { undo?: ToastItem["undo"]; tone?: ToastItem["tone"]; ms?: number } = {}) {
    clearTimeout(timer);
    current.value = { id: Date.now(), text, undo: opts.undo, tone: opts.tone };
    timer = setTimeout(() => (current.value = null), opts.ms ?? (opts.undo ? 6000 : 3500));
  }
  const dismiss = () => (current.value = null);
  return { current, show, dismiss };
}
