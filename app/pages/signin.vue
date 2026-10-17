<script setup lang="ts">
import type { Component } from "vue";
import { ArrowRight, ChevronRight, HeartPulse, ShieldCheck, Stethoscope, UserRound, Users } from "lucide-vue-next";
import type { Account } from "#shared/accounts";
import type { TextKey } from "#shared/i18n";
import { ROLES, type Role } from "#shared/model";

// Sign-in: pick how you use Langkah, then your account.
const T = useT();
const route = useRoute();
const { account, signIn } = useSession();
const accounts = useAccounts();
onMounted(accounts.load);

const looks: Record<Role, { icon: Component; role: TextKey; does: TextKey }> = {
  patient: { icon: UserRound, role: "rolePatient", does: "roleDoPatient" },
  family: { icon: Users, role: "roleFamily", does: "roleDoFamily" },
  physio: { icon: HeartPulse, role: "rolePhysio", does: "roleDoPhysio" },
  doctor: { icon: Stethoscope, role: "roleDoctor", does: "roleDoDoctor" },
  admin: { icon: ShieldCheck, role: "roleAdmin", does: "roleDoAdmin" },
};
const role = ref<Role>(account.value?.role ?? "patient");
const list = computed(() => accounts.list.value.filter((a) => a.role === role.value && a.active));
const next = computed(() => (typeof route.query.next === "string" ? route.query.next : undefined));
const open = (a: Account) => signIn(a, next.value);
const initials = (name: string) => name.replace(/^(Pak|Bu|Ibu|Mas|dr\.)\s+/i, "").slice(0, 1).toUpperCase();
</script>

<template>
  <section class="signin">
    <header class="signin-head">
      <span class="brand-mark big" aria-hidden="true" />
      <h1>{{ T("signInTitle") }}</h1>
      <p class="hint">{{ T("signInLede") }}</p>
    </header>

    <button v-if="account" class="primary big-btn" @click="signIn(account)">
      {{ T("continueAs", { name: account.name }) }} <ArrowRight class="ic" aria-hidden="true" />
    </button>

    <div class="role-pick" role="radiogroup" :aria-label="T('signInLede')">
      <button v-for="r in ROLES" :key="r" role="radio" :aria-checked="role === r" class="role-opt" :class="[`role-${r}`, { on: role === r }]" @click="role = r">
        <span class="role-ic"><component :is="looks[r].icon" class="ic" aria-hidden="true" /></span>
        <b>{{ T(looks[r].role) }}</b>
        <span class="role-does">{{ T(looks[r].does) }}</span>
      </button>
    </div>

    <ul class="acct-list">
      <li v-for="a in list" :key="a.id">
        <button class="acct" :class="`role-${a.role}`" @click="open(a)">
          <span class="avatar" aria-hidden="true">{{ initials(a.name) }}</span>
          <span class="acct-main"><b>{{ a.name }}</b><span class="hint">{{ T(looks[a.role].role) }}</span></span>
          <ChevronRight class="ic" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <NuxtLink to="/" class="link back">{{ T("back") }}</NuxtLink>
  </section>
</template>

<style scoped>
.signin { max-width: 520px; margin: 0 auto; display: grid; gap: 20px; padding-top: 8px; }
.signin-head { display: grid; gap: 8px; justify-items: start; }
.signin-head h1 { font-size: clamp(1.75rem, 7vw, 2.25rem); }
.brand-mark.big { width: 40px; height: 40px; }
.role-pick { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.role-opt { display: grid; justify-items: start; align-content: start; gap: 4px; min-height: 120px; padding: 14px; text-align: left; border-radius: var(--r-card); border: 2px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.role-opt:active { transform: scale(0.97); }
.role-opt.on { border-color: var(--pine); box-shadow: var(--shadow-sm); }
.role-ic { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; margin-bottom: 6px; background: var(--sunken); }
.role-patient .role-ic { background: var(--pine-soft); color: var(--role-patient); }
.role-family .role-ic { background: var(--dawn-soft); color: var(--role-family); }
.role-physio .role-ic { background: var(--info-soft); color: var(--role-physio); }
.role-doctor .role-ic { color: var(--role-doctor); }
.role-admin { grid-column: 1 / -1; min-height: 0; }
.role-admin .role-ic { color: var(--ink-2); }
.role-does { font-size: 0.875rem; color: var(--ink-2); }
.acct-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.acct { width: 100%; display: flex; gap: 12px; align-items: center; min-height: 64px; padding: 10px 14px; border-radius: var(--r-card); border: 1px solid var(--line); background: var(--surface); color: var(--ink); text-align: left; cursor: pointer; transition: transform var(--dur-press) var(--ease-out); }
.acct:active { transform: scale(0.98); }
.acct-main { display: grid; flex: 1; min-width: 0; }
.avatar { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--pine-soft); color: var(--pine); font-weight: 700; flex: none; }
.back { justify-self: center; }
@media (max-width: 359px) { .role-pick { grid-template-columns: minmax(0, 1fr); } }
</style>
