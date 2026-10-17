<script setup lang="ts">
import type { Component } from "vue";
import { ChevronRight, HeartPulse, LogOut, Menu, RotateCcw, Stethoscope, UserRound, Users } from "lucide-vue-next";
import type { Lang } from "#shared/exercises";
import { locale, type TextKey } from "#shared/i18n";
import type { Role } from "#shared/model";

const lang = useLang();
const T = useT();
const api = useApi();
const route = useRoute();
const version = useDataVersion();
const { now, day } = useDemoClock();
const { account, signOut } = useSession();
const textSize = useTextSize();
const busy = ref(false);
const langs: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "id", label: "ID" },
  { id: "zh", label: "中文" },
];
const roleLook: Record<Role, { key: TextKey; icon: Component }> = {
  patient: { key: "rolePatient", icon: UserRound },
  family: { key: "roleFamily", icon: Users },
  physio: { key: "rolePhysio", icon: HeartPulse },
  doctor: { key: "roleDoctor", icon: Stethoscope },
};
// Phone header keeps only brand, language and "More"; everything else lives in the sheet (Hick's law).
const menuOpen = ref(false);
const confirmOpen = ref(false);
watch(() => route.fullPath, () => (menuOpen.value = false));
// Inside an account's screens: show who is signed in and the demo clock.
const inAccount = computed(() => !!account.value && /^\/(patient|care|family)/.test(route.path));
const look = computed(() => (account.value ? roleLook[account.value.role] : null));

async function loadClock() {
  try {
    const s = await api<{ workspace: { offsetDays: number }; now: number }>("/api/demo/state");
    now.value = s.now;
    day.value = s.workspace.offsetDays;
  } catch {}
}
onMounted(loadClock);
// Keep <html lang> in step with the chosen language (screen readers, and Chinese line spacing).
watch(lang, (l) => (document.documentElement.lang = l), { immediate: true });
watch(version, loadClock);

const dateLabel = computed(() => (now.value ? new Date(now.value).toLocaleDateString(locale(lang.value), { weekday: "short", day: "numeric", month: "short" }) : ""));

async function nextDay() {
  busy.value = true;
  try {
    await api("/api/demo/next-day", { method: "POST" });
    version.value++;
  } finally {
    busy.value = false;
  }
}

async function reset() {
  confirmOpen.value = false;
  menuOpen.value = false;
  busy.value = true;
  try {
    await api("/api/demo/reset", { method: "POST" });
    version.value++;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <header class="appbar" :class="inAccount && account ? `role-${account.role}` : ''">
      <div class="appbar-inner">
        <NuxtLink to="/" class="brand"><span class="brand-mark" aria-hidden="true" />Langkah</NuxtLink>
        <nav class="navlinks wide-only">
          <NuxtLink to="/" :class="{ on: route.path === '/' }">{{ T("switchAccount") }}</NuxtLink>
          <NuxtLink to="/demo" :class="{ on: route.path === '/demo' || route.path.startsWith('/s/') }">{{ T("guidedDemo") }}</NuxtLink>
        </nav>
        <div class="appbar-right">
          <template v-if="inAccount && account && look">
            <span class="account-chip wide-only"><component :is="look.icon" class="ic" aria-hidden="true" /> {{ account.name }} · {{ T(look.key) }}</span>
            <span class="clock wide-only">{{ dateLabel }}<template v-if="day"> · {{ T("dayPlus", { n: day }) }}</template></span>
            <button class="ghost small-btn wide-only" :disabled="busy" @click="nextDay">{{ T("nextDay") }} <ChevronRight class="ic" aria-hidden="true" /></button>
          </template>
          <button class="ghost small-btn wide-only" :disabled="busy" @click="confirmOpen = true"><RotateCcw class="ic" aria-hidden="true" /> {{ T("resetDemo") }}</button>
          <div class="seg wide-only" role="group" :aria-label="T('languageLabel')">
            <button v-for="l in langs" :key="l.id" :class="{ on: lang === l.id }" @click="setLang(l.id)">{{ l.label }}</button>
          </div>
          <button class="ghost small-btn phone-only" @click="menuOpen = true"><Menu class="ic" aria-hidden="true" /> {{ T("more") }}</button>
        </div>
      </div>
      <!-- Who am I signed in as? A 4px role strip, plus the name in words on phones. -->
      <div v-if="inAccount" class="role-strip" aria-hidden="true" />
    </header>
    <p v-if="inAccount && account && look" class="role-now phone-only"><component :is="look.icon" class="ic" aria-hidden="true" /> {{ T("signedInAs") }}: <b>{{ account.name }}</b> · {{ T(look.key) }}</p>

    <UiSheet :open="menuOpen" :title="T('more')" @close="menuOpen = false">
      <section v-if="account && look" class="menu-group">
        <h3>{{ T("signedInAs") }}</h3>
        <p class="account-line"><component :is="look.icon" class="ic" aria-hidden="true" /> <b>{{ account.name }}</b> · {{ T(look.key) }}</p>
        <button class="ghost big-btn" @click="signOut"><LogOut class="ic" aria-hidden="true" /> {{ T("switchAccount") }}</button>
      </section>
      <section class="menu-group">
        <h3>{{ T("settings") }}</h3>
        <p class="hint">{{ T("languageLabel") }}</p>
        <div class="seg seg-full" role="group" :aria-label="T('languageLabel')">
          <button v-for="l in langs" :key="l.id" :class="{ on: lang === l.id }" @click="setLang(l.id)">{{ l.label }}</button>
        </div>
        <p class="hint">{{ T("textSize") }}</p>
        <div class="seg seg-full" role="group" :aria-label="T('textSize')">
          <button v-for="t in TEXT_SIZES" :key="t" :class="[`ts-${t}`, { on: textSize === t }]" @click="textSize = t">{{ T(`textSize_${t}`) }}</button>
        </div>
      </section>
      <nav class="menu-links">
        <NuxtLink v-if="!account" to="/" class="menu-link">{{ T("switchAccount") }}</NuxtLink>
        <NuxtLink to="/demo" class="menu-link">{{ T("guidedDemo") }}</NuxtLink>
      </nav>
      <section class="menu-group">
        <h3>{{ T("demoControls") }}</h3>
        <p v-if="inAccount" class="hint">{{ T("demoDate") }}: {{ dateLabel }}<template v-if="day"> · {{ T("dayPlus", { n: day }) }}</template></p>
        <button v-if="inAccount" class="ghost big-btn" :disabled="busy" @click="nextDay">{{ T("nextDay") }} <ChevronRight class="ic" aria-hidden="true" /></button>
        <button class="ghost danger big-btn" :disabled="busy" @click="confirmOpen = true"><RotateCcw class="ic" aria-hidden="true" /> {{ T("resetDemo") }}</button>
      </section>
    </UiSheet>

    <UiConfirmDialog :open="confirmOpen" :title="T('resetDemo')" :body="T('confirmReset')" :confirm-label="T('resetAction')" danger @confirm="reset" @cancel="confirmOpen = false" />

    <main class="page">
      <slot />
    </main>
    <UiToaster />
  </div>
</template>
