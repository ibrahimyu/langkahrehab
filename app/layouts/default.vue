<script setup lang="ts">
import type { Component } from "vue";
import { HeartPulse, LogOut, Menu, Stethoscope, UserRound, Users } from "lucide-vue-next";
import { homeFor } from "#shared/accounts";
import type { Lang } from "#shared/exercises";
import type { TextKey } from "#shared/i18n";
import type { Role } from "#shared/model";

const lang = useLang();
const T = useT();
const route = useRoute();
const { account, signOut } = useSession();
const textSize = useTextSize();
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
watch(() => route.fullPath, () => (menuOpen.value = false));
const inAccount = computed(() => !!account.value && /^\/(patient|care|family)/.test(route.path));
const look = computed(() => (account.value ? roleLook[account.value.role] : null));
const showSignIn = computed(() => !inAccount.value && route.path !== "/signin");
// Keep <html lang> in step with the chosen language (screen readers, and Chinese line spacing).
watch(lang, (l) => (document.documentElement.lang = l), { immediate: true });
</script>

<template>
  <div>
    <header class="appbar" :class="inAccount && account ? `role-${account.role}` : ''">
      <div class="appbar-inner">
        <NuxtLink :to="inAccount && account ? homeFor(account) : '/'" class="brand"><span class="brand-mark" aria-hidden="true" />Langkah</NuxtLink>
        <div class="appbar-right">
          <span v-if="inAccount && account && look" class="account-chip wide-only"><component :is="look.icon" class="ic" aria-hidden="true" /> {{ account.name }} · {{ T(look.key) }}</span>
          <div class="seg wide-only" role="group" :aria-label="T('languageLabel')">
            <button v-for="l in langs" :key="l.id" :class="{ on: lang === l.id }" @click="setLang(l.id)">{{ l.label }}</button>
          </div>
          <NuxtLink v-if="showSignIn" :to="account ? homeFor(account) : '/signin'" class="primary small-btn">{{ account ? T("continueAs", { name: account.name }) : T("lpSignIn") }}</NuxtLink>
          <button class="ghost small-btn" :class="{ 'phone-only': !inAccount }" :aria-label="T('more')" @click="menuOpen = true"><Menu class="ic" aria-hidden="true" /><span class="wide-only">{{ T("more") }}</span></button>
        </div>
      </div>
    </header>

    <UiSheet :open="menuOpen" :title="T('more')" @close="menuOpen = false">
      <section v-if="account && look" class="menu-group">
        <p class="account-line"><component :is="look.icon" class="ic" aria-hidden="true" /> <b>{{ account.name }}</b> · {{ T(look.key) }}</p>
        <button class="ghost big-btn" @click="signOut"><LogOut class="ic" aria-hidden="true" /> {{ T("signOut") }}</button>
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
    </UiSheet>

    <main class="page">
      <slot />
    </main>
    <UiToaster />
  </div>
</template>
