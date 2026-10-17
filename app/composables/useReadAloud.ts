import { locale } from "#shared/i18n";

// Read aloud (PAS-12) with the browser's own voice, in the app language. Hidden where there is none.
export function useReadAloud() {
  const lang = useLang();
  const speaking = ref(false);
  const supported = ref(false);
  onMounted(() => (supported.value = "speechSynthesis" in window));
  onBeforeUnmount(() => supported.value && speechSynthesis.cancel());
  function toggle(text: string) {
    if (!supported.value) return;
    if (speaking.value) {
      speechSynthesis.cancel();
      speaking.value = false;
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale(lang.value);
    u.rate = 0.92;
    u.onend = u.onerror = () => (speaking.value = false);
    speaking.value = true;
    speechSynthesis.speak(u);
  }
  return { speaking, supported, toggle };
}
