import type { Lang } from "#shared/exercises";
import { t as translate, type TextKey } from "#shared/i18n";

const KEY = "langkah-lang";

/** App-wide language (English, Indonesian or Chinese). The voice coach speaks it too. */
export function useLang() {
  const lang = useState<Lang>("lang", () => "en");
  onMounted(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved && ["en", "id", "zh"].includes(saved)) lang.value = saved;
    } catch {}
  });
  return lang;
}

export function setLang(l: Lang) {
  useState<Lang>("lang").value = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {}
  document.documentElement.lang = l;
}

/** Translation function bound to the current language. */
export function useT() {
  const lang = useLang();
  return (key: TextKey, params?: Record<string, string | number>) => translate(lang.value, key, params);
}

/** Bumped after any save, so open views (phone and dashboard) refresh together. */
export function useDataVersion() {
  return useState("data-version", () => 0);
}

/** "Once a day, every day" for a plan, in the app language. */
export function useScheduleText() {
  const T = useT();
  return (p: { perDay?: number; daysPerWeek?: number }) => {
    const per = p.perDay ?? 1;
    const days = p.daysPerWeek ?? 7;
    return `${T("schedTimesDay", { n: per })}, ${days === 7 ? T("schedEveryDay") : T("schedNDays", { n: days })}`;
  };
}
