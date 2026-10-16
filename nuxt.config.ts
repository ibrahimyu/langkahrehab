export default defineNuxtConfig({
  compatibilityDate: "2026-10-15",
  devtools: { enabled: false },
  // Single-page app: all data is per visitor (Firebase anonymous sign-in), so nothing to render on the server.
  ssr: false,
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    // Server-only, from NUXT_* environment variables (see .env.example).
    geminiApiKey: "",
    liveModel: "gemini-3.8-live",
    textModel: "gemini-3.8-flash",
    /** "local" (files in .data/, for development) or "firestore". */
    storage: "local",
    public: {
      // Firebase web config. When apiKey is set, visitors sign in anonymously and each gets their own demo copy.
      firebase: { apiKey: "", authDomain: "", projectId: "", appId: "" },
    },
  },
  nitro: {
    storage: { data: { driver: "fs", base: "./.data" } },
  },
  app: {
    head: {
      title: "Langkah · AI rehab coach",
      htmlAttrs: { lang: "en" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#13262B" },
        { name: "description", content: "Langkah keeps amputee patients exercising at home and keeps their doctor and physiotherapist in the loop." },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
        },
      ],
    },
  },
  typescript: { strict: true },
});
