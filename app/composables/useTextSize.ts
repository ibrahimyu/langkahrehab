// Text size chosen by the person (More → Settings), saved on this device. Every size in the CSS is
// in rem, so changing the root size scales the whole app, on top of the phone's own text setting.
export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
const ROOT: Record<TextSize, string> = { sm: "93.75%", md: "100%", lg: "112.5%", xl: "125%" };
const KEY = "langkah-text-size";

export function useTextSize() {
  const size = useState<TextSize>("text-size", () => {
    try {
      const saved = localStorage.getItem(KEY) as TextSize | null;
      return saved && TEXT_SIZES.includes(saved) ? saved : "md";
    } catch {
      return "md";
    }
  });
  watch(
    size,
    (s) => {
      document.documentElement.style.fontSize = ROOT[s];
      try {
        localStorage.setItem(KEY, s);
      } catch {}
    },
    { immediate: true },
  );
  return size;
}
