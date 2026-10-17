<script setup lang="ts">
import type { Component } from "vue";
import { ArrowRight, Camera, HeartPulse, Mic, PlayCircle, ShieldCheck, Stethoscope, UserRound, Users } from "lucide-vue-next";
import { homeFor } from "#shared/accounts";
import type { TextKey } from "#shared/i18n";

const T = useT();
const { account } = useSession();
const start = computed(() => (account.value ? homeFor(account.value) : "/signin"));

const training: { icon: Component; title: TextKey; body: TextKey }[] = [
  { icon: Mic, title: "lpVoiceT", body: "lpVoiceB" },
  { icon: Camera, title: "lpCameraT", body: "lpCameraB" },
  { icon: PlayCircle, title: "lpTutorT", body: "lpTutorB" },
];
const roles: { icon: Component; role: TextKey; body: TextKey; tone: string }[] = [
  { icon: UserRound, role: "rolePatient", body: "lpRolePatient", tone: "patient" },
  { icon: Users, role: "roleFamily", body: "lpRoleFamily", tone: "family" },
  { icon: HeartPulse, role: "rolePhysio", body: "lpRolePhysio", tone: "physio" },
  { icon: Stethoscope, role: "roleDoctor", body: "lpRoleDoctor", tone: "doctor" },
];
const safety: TextKey[] = ["lpSafe1", "lpSafe2", "lpSafe3"];
</script>

<template>
  <div class="landing">
    <section class="hero2">
      <div>
        <p class="eyebrow">{{ T("lpEyebrow") }}</p>
        <h1 class="hero-title">{{ T("tagline") }}</h1>
        <p class="lede">{{ T("lede") }}</p>
        <div class="actions">
          <NuxtLink :to="start" class="primary pill-btn">{{ account ? T("continueAs", { name: account.name }) : T("lpSignIn") }} <ArrowRight class="ic" aria-hidden="true" /></NuxtLink>
          <a href="#training" class="link">{{ T("lpHow") }}</a>
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <span class="glow sun" />
        <span class="glow sky" />
        <div class="preview">
          <div class="phone"><PatientHome patient-id="budi" variant="home" /></div>
        </div>
      </div>
    </section>

    <section id="training" class="lp-section">
      <header class="lp-head">
        <h2>{{ T("lpTrainTitle") }}</h2>
        <p class="hint">{{ T("lpTrainLede") }}</p>
      </header>
      <div class="lp-grid">
        <article v-for="f in training" :key="f.title" class="card lp-card">
          <span class="lp-ic"><component :is="f.icon" class="ic" aria-hidden="true" /></span>
          <h3>{{ T(f.title) }}</h3>
          <p>{{ T(f.body) }}</p>
        </article>
      </div>
    </section>

    <section class="lp-section">
      <header class="lp-head">
        <h2>{{ T("lpNavTitle") }}</h2>
        <p class="hint">{{ T("lpNavLede") }}</p>
      </header>
      <div class="lp-grid lp-roles">
        <article v-for="r in roles" :key="r.role" class="card lp-card" :class="`role-${r.tone}`">
          <span class="lp-ic"><component :is="r.icon" class="ic" aria-hidden="true" /></span>
          <h3>{{ T(r.role) }}</h3>
          <p>{{ T(r.body) }}</p>
        </article>
      </div>
    </section>

    <section class="lp-section lp-safe card">
      <h2><ShieldCheck class="ic" aria-hidden="true" /> {{ T("lpSafeTitle") }}</h2>
      <ul>
        <li v-for="k in safety" :key="k">{{ T(k) }}</li>
      </ul>
    </section>

    <section class="lp-section lp-cta">
      <h2>{{ T("lpCtaTitle") }}</h2>
      <NuxtLink :to="start" class="primary pill-btn">{{ T("lpSignIn") }} <ArrowRight class="ic" aria-hidden="true" /></NuxtLink>
    </section>

    <footer class="lp-foot hint">{{ T("lpFoot") }}</footer>
  </div>
</template>

<style scoped>
.landing { display: grid; gap: 56px; overflow-x: clip; }
.hero2 .actions .primary { display: inline-flex; gap: 8px; align-items: center; text-decoration: none; }
.lp-section { display: grid; gap: 20px; }
.lp-head { display: grid; gap: 8px; max-width: 640px; }
.lp-head h2, .lp-cta h2, .lp-safe h2 { font-size: clamp(1.5rem, 5vw, 2rem); }
.lp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 14px; }
.lp-card { display: grid; gap: 8px; align-content: start; }
.lp-card h3 { font-size: 1.125rem; }
.lp-card p { margin: 0; color: var(--ink-2); }
.lp-ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--pine-soft); color: var(--pine); }
.lp-ic .ic { width: 22px; height: 22px; }
.lp-roles .role-family .lp-ic { background: var(--dawn-soft); color: var(--role-family); }
.lp-roles .role-physio .lp-ic { background: var(--info-soft); color: var(--role-physio); }
.lp-roles .role-doctor .lp-ic { background: var(--sunken); color: var(--role-doctor); }
.lp-safe h2 { display: flex; gap: 10px; align-items: center; }
.lp-safe ul { margin: 0; padding-left: 1.2em; display: grid; gap: 10px; color: var(--ink-2); }
.lp-cta { justify-items: center; text-align: center; padding: 24px 0; }
.lp-cta .primary { display: inline-flex; gap: 8px; align-items: center; text-decoration: none; padding: 15px 26px; min-height: 56px; }
.lp-foot { text-align: center; max-width: 640px; margin: 0 auto; }
</style>
