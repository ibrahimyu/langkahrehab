<script setup lang="ts">
import type { PatientSummary } from "#shared/model";
import { ago, profileText } from "#shared/i18n";

// Care team patient list (basic version; see docs/tasks.md for the full care team app).
const api = useApi();
const role = useRole();
const lang = useLang();
const T = useT();
onMounted(() => {
  if (role.value === "patient") role.value = "physio";
});
const { data, error } = useAsyncData("care-patients", () => api<{ patients: PatientSummary[]; now: number }>("/api/patients"), { server: false });
const rank = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
const patients = computed(() =>
  [...(data.value?.patients ?? [])].sort(
    (a, b) => (a.topSeverity ? rank[a.topSeverity] : 9) - (b.topSeverity ? rank[b.topSeverity] : 9) || a.reviewDate.localeCompare(b.reviewDate),
  ),
);
const since = (iso: string | null) => (!iso || !data.value ? T("never") : ago(lang.value, Math.floor((data.value.now - Date.parse(iso)) / 86_400_000)));
</script>

<template>
  <div class="care-page" style="max-width: 1000px; margin: 0 auto">
    <header class="care-head">
      <p class="eyebrow">{{ T("careTeam") }} · {{ role === "doctor" ? T("roleDoctor") : T("rolePhysio") }}</p>
      <h1>{{ T("patients") }}</h1>
      <p class="hint">{{ T("sortedHint") }}</p>
    </header>
    <p v-if="error" class="error">{{ errorMessage(error) }}</p>
    <section class="card">
      <table>
        <thead><tr><th>{{ T("patients") }}</th><th>{{ T("alerts") }}</th><th>{{ T("lastSessionCol") }}</th><th>{{ T("reviewCol") }}</th><th></th></tr></thead>
        <tbody>
          <tr v-for="p in patients" :key="p.id">
            <td><b>{{ p.name }}</b>, {{ p.age }}<br /><span class="hint">{{ profileText(lang, p.profile) }}</span></td>
            <td><span v-if="p.openAlerts" class="pill alert-pill" :class="p.topSeverity ?? ''">{{ p.openAlerts }}</span><span v-else class="hint">{{ T("none") }}</span></td>
            <td>{{ since(p.lastSessionAt) }}</td>
            <td>{{ p.reviewDate }}</td>
            <td><NuxtLink :to="`/care/${p.id}`" class="link">{{ T("open") }}</NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
