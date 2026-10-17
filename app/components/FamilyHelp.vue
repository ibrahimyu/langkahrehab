<script setup lang="ts">
import { ArrowLeft, Droplet, Droplets, Footprints, HeartCrack, PersonStanding, PhoneCall, Siren, Thermometer, Zap } from "lucide-vue-next";
import type { Component } from "vue";
import type { TextKey } from "#shared/i18n";
import { CRISIS_LINE, CLINIC_PHONE } from "#shared/family";

// When to contact the clinic (KEL-06): a fixed list from the clinical rules, never AI, always one tap
// away in the family app. Clinic number is made up for the demo and labelled so.
defineProps<{ patientId: string }>();
const T = useT();
const signs: { key: TextKey; icon: Component }[] = [
  { key: "famSign_bleeding", icon: Droplet },
  { key: "famSign_wound", icon: Droplets },
  { key: "famSign_fall", icon: PersonStanding },
  { key: "famSign_fever", icon: Thermometer },
  { key: "famSign_pain", icon: Zap },
  { key: "famSign_foot", icon: Footprints },
  { key: "famSign_despair", icon: HeartCrack },
];
const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
</script>

<template>
  <section class="fam-help">
    <NuxtLink :to="`/family/${patientId}`" class="link with-ic back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("back") }}</NuxtLink>
    <h1>{{ T("famWhenToCall") }}</h1>
    <article class="card stack">
      <p><b>{{ T("famCallIf") }}</b></p>
      <ul class="signs">
        <li v-for="s in signs" :key="s.key"><span class="sign-ic" aria-hidden="true"><component :is="s.icon" class="ic" /></span>{{ T(s.key) }}</li>
      </ul>
    </article>
    <div class="stack">
      <a class="primary big-btn" :href="tel(CLINIC_PHONE)"><PhoneCall class="ic" aria-hidden="true" /> {{ T("famCallClinic") }}</a>
      <a class="ghost big-btn" :href="tel(CRISIS_LINE)"><PhoneCall class="ic" aria-hidden="true" /> {{ T("famCrisisLine", { n: CRISIS_LINE }) }}</a>
      <a class="danger-btn big-btn" href="tel:112"><Siren class="ic" aria-hidden="true" /> {{ T("famEmergency") }}</a>
    </div>
  </section>
</template>

<style scoped>
.fam-help { display: grid; gap: 14px; }
.fam-help h1 { font-size: 1.625rem; }
.back { justify-self: start; min-height: 44px; }
.signs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.signs li { display: flex; align-items: center; gap: 12px; font-size: 1.0625rem; }
.sign-ic { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--attention-soft); color: var(--attention-ink); flex: none; }
.sign-ic .ic { width: 20px; height: 20px; }
.demo-pill { margin-left: 4px; }
</style>
