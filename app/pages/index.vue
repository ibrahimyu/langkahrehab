<script setup lang="ts">
import type { Component } from "vue";
import { ArrowRight, HeartPulse, Stethoscope, UserRound, Users } from "lucide-vue-next";
import { demoAccounts, type DemoAccount } from "#shared/accounts";
import type { TextKey } from "#shared/i18n";
import type { Role } from "#shared/model";

// Sign-in: one card per role, one tap per account (demo accounts, no password).
// The question in the title is the one in the visitor's head (DESIGN §8c, QuestionHeader).
const T = useT();
const route = useRoute();
const { account, signIn } = useSession();

const looks: Record<Role, { icon: Component; role: TextKey; does: TextKey }> = {
  patient: { icon: UserRound, role: "rolePatient", does: "roleDoPatient" },
  family: { icon: Users, role: "roleFamily", does: "roleDoFamily" },
  physio: { icon: HeartPulse, role: "rolePhysio", does: "roleDoPhysio" },
  doctor: { icon: Stethoscope, role: "roleDoctor", does: "roleDoDoctor" },
};
const main = (["budi", "sri", "rina", "hendra"] as const).map((id) => demoAccounts.find((a) => a.id === id)!);
const others = demoAccounts.filter((a) => a.role === "patient" && a.id !== "budi");
const next = computed(() => (typeof route.query.next === "string" ? route.query.next : undefined));
const open = (a: DemoAccount) => a.ready && signIn(a, next.value);
</script>

<template>
  <section class="signin">
    <header class="signin-head">
      <p class="eyebrow">Langkah</p>
      <h1>{{ T("signInTitle") }}</h1>
      <p class="hint">{{ T("signInLede") }}</p>
    </header>

    <button v-if="account" class="primary big-btn" @click="signIn(account)">
      {{ T("continueAs", { name: account.name }) }} <ArrowRight class="ic" aria-hidden="true" />
    </button>

    <div class="account-grid">
      <button v-for="a in main" :key="a.id" class="account-card" :class="`role-${a.role}`" :disabled="!a.ready" @click="open(a)">
        <span class="account-icon"><component :is="looks[a.role].icon" class="ic" aria-hidden="true" /></span>
        <span class="account-role">{{ T(looks[a.role].role) }}</span>
        <b class="account-name">{{ a.name }}</b>
        <span class="account-does">{{ T(looks[a.role].does) }}</span>
        <span v-if="!a.ready" class="pill">{{ T("comingSoon") }}</span>
      </button>
    </div>

    <section class="signin-more">
      <h2>{{ T("otherPatients") }}</h2>
      <div class="controls">
        <button v-for="a in others" :key="a.id" class="ghost" @click="open(a)"><UserRound class="ic" aria-hidden="true" /> {{ a.name }}</button>
      </div>
    </section>

    <p class="hint">{{ T("demoAccountsNote") }}</p>
    <NuxtLink to="/demo" class="link with-ic">{{ T("guidedDemo") }} <ArrowRight class="ic" aria-hidden="true" /></NuxtLink>
  </section>
</template>

<style scoped>
.signin { max-width: 560px; margin: 0 auto; display: grid; gap: 20px; padding-top: 8px; }
.signin-head { display: grid; gap: 6px; }
.signin-head h1 { font-size: clamp(1.75rem, 7vw, 2.25rem); }
.account-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
/* Whole card is the target (Fitts): 160px tall, icon + role + name + what you do there. */
.account-card { display: grid; align-content: start; justify-items: start; gap: 4px; min-height: 168px; padding: 16px; text-align: left; border-radius: var(--r-card); border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.account-card:active { transform: scale(0.97); }
@media (hover: hover) and (pointer: fine) { .account-card:not(:disabled):hover { border-color: currentColor; } }
.account-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; margin-bottom: 8px; background: var(--sunken); }
.account-icon .ic { width: 24px; height: 24px; }
.account-role { font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.account-name { font-size: 1.25rem; color: var(--ink); }
.account-does { font-size: 0.9375rem; color: var(--ink-2); }
.account-card.role-patient { color: var(--role-patient); }
.account-card.role-family { color: var(--role-family); }
.account-card.role-physio { color: var(--role-physio); }
.account-card.role-doctor { color: var(--role-doctor); }
.account-card.role-patient .account-icon { background: var(--pine-soft); }
.account-card.role-family .account-icon { background: var(--dawn-soft); }
.account-card.role-physio .account-icon { background: var(--info-soft); }
.account-card.role-doctor .account-icon { background: var(--sunken); }
.account-card .pill { margin-top: 6px; }
.signin-more { display: grid; gap: 10px; }
.signin-more h2 { font-size: 1rem; color: var(--ink-2); }
@media (max-width: 359px) { .account-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
