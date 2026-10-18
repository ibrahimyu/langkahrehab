<script setup lang="ts">
import type { Component } from "vue";
import { BellRing, Menu, Sun, Users } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";
import type { CareSummary } from "#shared/triage";

// The care team's own places (UXA-01): Today · Patients · Alerts · More. A bottom bar in the thumb
// zone on a phone, a rail on the left from 1024 px. "More" opens the same sheet as the header
// (account, language, text size), so demo controls live there on a phone.
const T = useT();
const route = useRoute();
const menuOpen = useState("menu-open", () => false);
const api = useApi();
const { data } = useAsyncData("care-patients", () => api<{ patients: CareSummary[]; now: number }>("/api/patients"), { server: false });
const openAlerts = computed(() => (data.value?.patients ?? []).reduce((n, p) => n + (p.openAlerts ?? 0), 0));

const tabs: { key: TextKey; icon: Component; to: string; match: (p: string) => boolean }[] = [
  { key: "careTabToday", icon: Sun, to: "/care", match: (p) => p === "/care" || p === "/care/" || p.startsWith("/care/intake") },
  { key: "careTabPatients", icon: Users, to: "/care/patients", match: (p) => p.startsWith("/care/patients") || (/^\/care\/[^/]+$/.test(p) && p !== "/care/alerts") },
  { key: "careTabAlerts", icon: BellRing, to: "/care/alerts", match: (p) => p.startsWith("/care/alerts") },
];
const isOn = (t: (typeof tabs)[number]) => t.match(route.path);
const { account } = useSession();
const accent = computed(() => (account.value?.role === "doctor" ? "var(--role-doctor)" : "var(--role-physio)"));
</script>

<template>
  <nav class="care-nav" :style="{ '--accent': accent }" :aria-label="T('tabsLabel')">
    <NuxtLink v-for="t in tabs" :key="t.key" :to="t.to" class="tab" :class="{ on: isOn(t) }" :aria-current="isOn(t) ? 'page' : undefined">
      <span class="tab-ic">
        <component :is="t.icon" class="ic" aria-hidden="true" />
        <span v-if="t.key === 'careTabAlerts' && openAlerts" class="tab-count">{{ openAlerts }}</span>
      </span>
      <span class="tab-label">{{ T(t.key) }}</span>
    </NuxtLink>
    <button class="tab" :class="{ on: menuOpen }" :aria-expanded="menuOpen" @click="menuOpen = true">
      <span class="tab-ic"><Menu class="ic" aria-hidden="true" /></span>
      <span class="tab-label">{{ T("more") }}</span>
    </button>
  </nav>
</template>

<style scoped>
.care-nav { position: fixed; left: 50%; bottom: 0; z-index: 40; transform: translateX(-50%); width: min(560px, 100%); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 8px 6px calc(10px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
@media (min-width: 600px) and (max-width: 1023px) { .care-nav { bottom: 12px; border: 0; border-radius: var(--r-sheet); box-shadow: var(--shadow-lg); padding-bottom: 8px; } }
.tab { position: relative; display: grid; justify-items: center; align-content: start; gap: 2px; min-height: 56px; padding: 4px 0 0; border: 0; background: none; font: inherit; color: var(--ink-3); font-size: 0.75rem; font-weight: 600; text-decoration: none; cursor: pointer; transition: color var(--dur-fast) var(--ease-out); }
.tab:active .tab-ic { transform: scale(0.92); }
.tab-ic { position: relative; display: grid; place-items: center; width: 52px; height: 30px; border-radius: var(--r-pill); transition: background-color var(--dur) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.tab-ic .ic { width: 24px; height: 24px; }
.tab-count { position: absolute; top: -4px; right: 2px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: var(--r-pill); background: var(--danger); color: var(--surface); font-size: 0.75rem; font-weight: 700; display: grid; place-items: center; font-variant-numeric: tabular-nums; border: 2px solid var(--surface); }
.tab-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab.on { color: var(--ink); font-weight: 700; }
.tab.on .tab-ic { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.tab.on::before { content: ""; position: absolute; top: -8px; left: 50%; width: 28px; height: 3px; margin-left: -14px; border-radius: 0 0 3px 3px; background: var(--accent); }
/* Laptop: a rail on the left, under the sticky header. */
@media (min-width: 1024px) {
  .care-nav { position: sticky; top: 76px; left: auto; bottom: auto; transform: none; width: 88px; height: fit-content; grid-template-columns: 1fr; gap: 6px; padding: 16px 8px; background: none; backdrop-filter: none; -webkit-backdrop-filter: none; border: 0; }
  .tab { min-height: 64px; }
  .tab.on::before { left: -8px; top: 6px; height: 30px; width: 3px; margin-left: 0; border-radius: 0 3px 3px 0; }
}
</style>
