// UXA-08: install as an app. The service worker runs in production builds only (it would cache
// the dev server's hot-reload files). The browser's install event is kept for the in-app hint.
export const installPrompt = ref<{ prompt: () => Promise<void> } | null>(null);

export default defineNuxtPlugin(() => {
  if (!import.meta.dev && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt.value = e as unknown as { prompt: () => Promise<void> };
  });
  window.addEventListener("appinstalled", () => (installPrompt.value = null));
});
