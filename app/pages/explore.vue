<script setup lang="ts">
import { profileText, stories } from "#shared/i18n";
import type { PatientSummary } from "#shared/model";

// Free exploration: every case, as the patient or the care team.
const api = useApi();
const role = useRole();
const lang = useLang();
const T = useT();
const { data, error } = useAsyncData("patients", () => api<{ patients: PatientSummary[] }>("/api/patients"), { server: false });

function open(id: string, as: "patient" | "physio") {
  role.value = as;
  navigateTo(as === "patient" ? `/patient/${id}` : `/care/${id}`);
}
</script>

<template>
  <section class="hero">
    <h1>{{ T("explore") }}</h1>
    <p class="hint">{{ T("madeUp") }}</p>
  </section>
  <p v-if="error" class="error">{{ errorMessage(error) }}</p>
  <section class="cases">
    <article v-for="p in data?.patients ?? []" :key="p.id" class="card case">
      <div class="bar">
        <h2>{{ p.name }}<span class="hint">, {{ p.age }}</span></h2>
        <span v-if="p.openAlerts" class="pill alert-pill" :class="p.topSeverity ?? ''">{{ p.openAlerts }} · {{ T("alerts") }}</span>
      </div>
      <p>{{ stories[p.id]?.[lang] ?? p.story }}</p>
      <p class="hint">{{ profileText(lang, p.profile) }}</p>
      <div class="controls">
        <button class="primary" @click="open(p.id, 'patient')">{{ T("openAsPatient") }}</button>
        <button class="ghost" @click="open(p.id, 'physio')">{{ T("careView") }}</button>
      </div>
    </article>
  </section>
</template>
