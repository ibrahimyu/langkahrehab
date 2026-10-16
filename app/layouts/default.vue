<script setup lang="ts">
import type { Lang } from "#shared/exercises";
import { locale } from "#shared/i18n";
import type { Role } from "#shared/model";

const role = useRole();
const lang = useLang();
const T = useT();
const api = useApi();
const route = useRoute();
const version = useDataVersion();
const { now, day } = useDemoClock();
const busy = ref(false);
const langs: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "id", label: "ID" },
  { id: "zh", label: "中文" },
];
const roles: { id: Role; key: "rolePatient" | "rolePhysio" | "roleDoctor" }[] = [
  { id: "patient", key: "rolePatient" },
  { id: "physio", key: "rolePhysio" },
  { id: "doctor", key: "roleDoctor" },
];
// The role switcher and demo clock belong to free exploring; guided scenarios drive both themselves.
const exploring = computed(() => /^\/(explore|patient|care)/.test(route.path));

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
  if (!confirm(T("confirmReset"))) return;
  busy.value = true;
  try {
    await api("/api/demo/reset", { method: "POST" });
    version.value++;
    await navigateTo("/");
  } finally {
    busy.value = false;
  }
}

function switchRole(r: Role) {
  role.value = r;
  const id = route.params.id as string | undefined;
  if (r === "patient") navigateTo(id ? `/patient/${id}` : "/explore");
  else navigateTo(id ? `/care/${id}` : "/care");
}
</script>

<template>
  <div>
    <header class="appbar">
      <div class="appbar-inner">
      <NuxtLink to="/" class="brand"><span class="brand-mark" aria-hidden="true" />Langkah</NuxtLink>
      <nav class="navlinks">
        <NuxtLink to="/" :class="{ on: !exploring }">{{ T("scenarios") }}</NuxtLink>
        <NuxtLink to="/explore" :class="{ on: exploring }">{{ T("explore") }}</NuxtLink>
      </nav>
      <div v-if="exploring" class="seg" role="group" aria-label="Role">
        <button v-for="r in roles" :key="r.id" :class="{ on: role === r.id }" @click="switchRole(r.id)">{{ T(r.key) }}</button>
      </div>
      <div class="appbar-right">
        <template v-if="exploring">
          <span class="clock">{{ dateLabel }}<template v-if="day"> · {{ T("dayPlus", { n: day }) }}</template></span>
          <button class="ghost small-btn" :disabled="busy" @click="nextDay">{{ T("nextDay") }}</button>
        </template>
        <button class="ghost small-btn pill-btn" :disabled="busy" @click="reset">↺ {{ T("resetDemo") }}</button>
        <div class="seg" role="group" aria-label="Language">
          <button v-for="l in langs" :key="l.id" :class="{ on: lang === l.id }" @click="setLang(l.id)">{{ l.label }}</button>
        </div>
      </div>
      </div>
    </header>
    <main class="page">
      <slot />
    </main>
  </div>
</template>
