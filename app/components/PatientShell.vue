<script setup lang="ts">
import type { Component } from "vue";
import { CalendarDays, House, MessageCircleHeart, Target, UserRound } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";

// The patient app: one centred column, and a bottom tab bar in the thumb zone with five places
// (DESIGN §0, UXA-01). Labels always show under the icons.
const props = defineProps<{ patientId: string }>();
const T = useT();
const route = useRoute();
const tabs: { key: TextKey; icon: Component; to: string }[] = [
  { key: "tabToday", icon: House, to: "" },
  { key: "tabGoals", icon: Target, to: "/goals" },
  { key: "tabCalendar", icon: CalendarDays, to: "/calendar" },
  { key: "tabTalk", icon: MessageCircleHeart, to: "/talk" },
  { key: "tabMe", icon: UserRound, to: "/me" },
];
const base = computed(() => `/patient/${props.patientId}`);
const isOn = (to: string) => (to ? route.path.startsWith(base.value + to) : route.path === base.value || route.path === `${base.value}/`);
</script>

<template>
  <div class="app-col patient-app">
    <slot />
    <PatientWelcome :patient-id="patientId" />
    <nav class="tabbar" :aria-label="T('tabsLabel')">
      <NuxtLink v-for="t in tabs" :key="t.key" :to="base + t.to" class="tab" :class="{ on: isOn(t.to) }" :aria-current="isOn(t.to) ? 'page' : undefined">
        <span class="tab-ic"><component :is="t.icon" class="ic" aria-hidden="true" /></span>
        <span>{{ T(t.key) }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.patient-app { padding-bottom: calc(92px + env(safe-area-inset-bottom)); }
.tabbar { position: fixed; left: 50%; bottom: 0; z-index: 40; transform: translateX(-50%); width: min(560px, 100%); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 8px 6px calc(10px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
@media (min-width: 600px) { .tabbar { bottom: 12px; border: 0; border-radius: var(--r-sheet); box-shadow: var(--shadow-lg); padding-bottom: 8px; } }
.tab { display: grid; justify-items: center; gap: 2px; min-height: 56px; padding-top: 4px; color: var(--ink-3); font-size: 0.75rem; font-weight: 600; text-decoration: none; transition: color var(--dur-fast) var(--ease-out); }
.tab:active .tab-ic { transform: scale(0.92); }
.tab-ic { display: grid; place-items: center; width: 52px; height: 30px; border-radius: var(--r-pill); transition: background-color var(--dur) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.tab-ic .ic { width: 22px; height: 22px; }
.tab.on { color: var(--ink); }
.tab.on .tab-ic { background: var(--pine-soft); color: var(--pine); }
</style>
