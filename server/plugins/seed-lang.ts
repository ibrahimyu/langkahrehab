import { localizeSeed } from "#shared/seedText";
import type { Lang } from "#shared/exercises";

const LANGS: Lang[] = ["en", "id", "zh"];

// Demo seed sentences follow the app's language (x-langkah-lang, sent by useApi); stored data is unchanged.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("beforeResponse", (event, response) => {
    const lang = getHeader(event, "x-langkah-lang") as Lang | undefined;
    if (!lang || !LANGS.includes(lang) || !event.path.startsWith("/api/")) return;
    if (response.body && typeof response.body === "object") response.body = localizeSeed(response.body, lang);
  });
});
