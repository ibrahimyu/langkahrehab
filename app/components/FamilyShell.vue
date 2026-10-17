<script setup lang="ts">
import type { Component } from "vue";
import { Check, ChevronDown, House, ListChecks, MessageCircleQuestion, RotateCw, Users } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";

// The family app (KEL-01): its own four places in a bottom tab bar, and "I am …" at the top so
// whoever holds the phone (Bu Sri, Dimas) sees their own tasks. Loading and error states live here once.
const props = defineProps<{ patientId: string }>();
const T = useT();
const route = useRoute();
const role = useRole();
const { view, loadError, me, setMe, load } = useFamily(props.patientId);
onMounted(() => {
  role.value = "family";
  load();
});

const tabs: { key: TextKey; icon: Component; to: string }[] = [
  { key: "famTabToday", icon: House, to: "" },
  { key: "famTabTasks", icon: ListChecks, to: "/tasks" },
  { key: "famTabQuestions", icon: MessageCircleQuestion, to: "/questions" },
  { key: "famTabFamily", icon: Users, to: "/members" },
];
const base = computed(() => `/family/${props.patientId}`);
const isOn = (to: string) => (to ? route.path.startsWith(base.value + to) : route.path === base.value || route.path === `${base.value}/`);
const picking = ref(false);
const pick = (id: string) => {
  setMe(id);
  picking.value = false;
};
</script>

<template>
  <div class="app-col family-app">
    <header v-if="view" class="fam-top">
      <span class="fam-patient">{{ view.name }}</span>
      <button v-if="me" class="fam-me" :aria-label="T('famWhoAreYou')" @click="picking = true">
        <span class="fam-avatar" aria-hidden="true">{{ me.name.replace(/^(Bu|Pak|Ibu|Bapak)\s+/, "")[0] }}</span>
        {{ T("famIAm", { name: me.name }) }}
        <ChevronDown class="ic" aria-hidden="true" />
      </button>
    </header>

    <div v-if="loadError" class="card stack fam-state" role="alert">
      <p class="error">{{ loadError }}</p>
      <button class="primary" @click="load"><RotateCw class="ic" aria-hidden="true" /> {{ T("tryAgain") }}</button>
    </div>
    <div v-else-if="!view" class="fam-skeleton" aria-busy="true">
      <span class="sk sk-card" /><span class="sk sk-line" /><span class="sk sk-line short" />
    </div>
    <slot v-else />

    <nav class="tabbar" :aria-label="T('tabsLabel')">
      <NuxtLink v-for="t in tabs" :key="t.key" :to="base + t.to" class="tab" :class="{ on: isOn(t.to) }" :aria-current="isOn(t.to) ? 'page' : undefined">
        <span class="tab-ic"><component :is="t.icon" class="ic" aria-hidden="true" /></span>
        <span>{{ T(t.key) }}</span>
      </NuxtLink>
    </nav>

    <UiSheet v-if="view" :open="picking" :title="T('famWhoAreYou')" @close="picking = false">
      <div class="who-list">
        <button v-for="m in view.family" :key="m.id" class="who" :class="{ on: me?.id === m.id }" :aria-pressed="me?.id === m.id" @click="pick(m.id)">
          <span class="fam-avatar" aria-hidden="true">{{ m.name.replace(/^(Bu|Pak|Ibu|Bapak)\s+/, "")[0] }}</span>
          <span class="who-name"><b>{{ m.name }}</b><span class="hint">{{ T(`rel_${m.relation}` as TextKey) }}</span></span>
          <Check v-if="me?.id === m.id" class="ic" aria-hidden="true" />
        </button>
      </div>
    </UiSheet>
  </div>
</template>

<style scoped>
.family-app { padding-bottom: calc(92px + env(safe-area-inset-bottom)); }
.fam-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.fam-patient { font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--role-family); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fam-me { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 4px 12px 4px 4px; border-radius: var(--r-pill); border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer; flex: none; transition: transform var(--dur-press) var(--ease-out); }
.fam-me:active { transform: scale(0.97); }
.fam-me .ic { width: 16px; height: 16px; color: var(--ink-3); }
.fam-avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--dawn-soft); color: var(--dawn-ink); font: 700 0.9375rem/1 var(--display); flex: none; }
.fam-state { margin-top: 8px; }
.fam-skeleton { display: grid; gap: 12px; }
.sk { display: block; border-radius: var(--r-card); background: var(--sunken); animation: sk-pulse 1.4s var(--ease-out) infinite alternate; }
.sk-card { height: 150px; }
.sk-line { height: 18px; width: 80%; border-radius: var(--r-pill); }
.sk-line.short { width: 50%; }
@keyframes sk-pulse { from { opacity: 1; } to { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
.who-list { display: grid; gap: 8px; }
.who { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 14px 8px 10px; border-radius: var(--r-card); border: 1px solid var(--line); background: var(--surface); color: var(--ink); text-align: left; cursor: pointer; transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.who:active { transform: scale(0.98); }
.who.on { border-color: var(--pine); }
.who .ic { color: var(--pine); margin-left: auto; }
.who-name { display: grid; gap: 2px; }
.tabbar { position: fixed; left: 50%; bottom: 0; z-index: 40; transform: translateX(-50%); width: min(560px, 100%); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 8px 6px calc(10px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
@media (min-width: 600px) { .tabbar { bottom: 12px; border: 0; border-radius: var(--r-sheet); box-shadow: var(--shadow-lg); padding-bottom: 8px; } }
.tab { display: grid; justify-items: center; gap: 2px; min-height: 56px; padding-top: 4px; color: var(--ink-3); font-size: 0.75rem; font-weight: 600; text-decoration: none; transition: color var(--dur-fast) var(--ease-out); }
.tab:active .tab-ic { transform: scale(0.92); }
.tab-ic { display: grid; place-items: center; width: 52px; height: 30px; border-radius: var(--r-pill); transition: background-color var(--dur) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.tab-ic .ic { width: 22px; height: 22px; }
.tab.on { color: var(--ink); }
.tab.on .tab-ic { background: var(--dawn-soft); color: var(--dawn-ink); }
</style>
