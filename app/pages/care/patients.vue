<script setup lang="ts">
import { CalendarClock, ChevronRight, CircleCheck, OctagonAlert, TriangleAlert, Info } from "lucide-vue-next";
import type { Component } from "vue";
import type { CareRole, Severity } from "#shared/model";
import { triage, type CareSummary } from "#shared/triage";
import { ago, locale, profileText, type TextKey } from "#shared/i18n";
import { MISSED_DAYS } from "#shared/rules";

// Care team: every patient this clinician looks after (UXA-01 "Patients"). One row per patient,
// the whole row is the way in. Those who need attention come first (same rules as Today).
const api = useApi();
const lang = useLang();
const T = useT();
const { data, error, status, refresh } = useAsyncData("care-patients", () => api<{ patients: CareSummary[]; now: number }>("/api/patients"), { server: false });
const { account } = useSession();
const roleKey = computed<TextKey>(() => (account.value?.role === "doctor" ? "roleDoctor" : "rolePhysio"));
const role = computed<CareRole>(() => (account.value?.role === "doctor" ? "doctor" : "physio"));
const now = computed(() => data.value?.now ?? Date.now());
const today = computed(() => triage(data.value?.patients ?? [], role.value, now.value));
const todayRank = computed(() => new Map(today.value.map((t, i) => [t.patient.id, i])));

const DAY = 86_400_000;
const rank: Record<Severity, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const sevIcon: Record<Severity, Component> = { urgent: OctagonAlert, high: TriangleAlert, medium: TriangleAlert, low: Info };
const daysSince = (iso: string | null) => (iso ? Math.floor((now.value - Date.parse(iso)) / DAY) : null);
const overdueDays = (date: string) => Math.floor((now.value - Date.parse(`${date}T23:59:59`)) / DAY) + 1;

const rows = computed(() =>
  [...(data.value?.patients ?? [])]
    .map((p) => {
      const idle = daysSince(p.lastSessionAt);
      const overdue = overdueDays(p.reviewDate);
      const missed = idle !== null && idle >= MISSED_DAYS;
      return { p, idle, overdue: overdue > 0 ? overdue : 0, missed, attention: todayRank.value.has(p.id) };
    })
    .sort((a, b) => (todayRank.value.get(a.p.id) ?? 99) - (todayRank.value.get(b.p.id) ?? 99) || (a.p.topSeverity ? rank[a.p.topSeverity] : 9) - (b.p.topSeverity ? rank[b.p.topSeverity] : 9) || a.p.reviewDate.localeCompare(b.p.reviewDate)),
);
const tab = ref<"attention" | "all">("all");
const shown = computed(() => (tab.value === "all" ? rows.value : rows.value.filter((r) => r.attention)));
const attentionCount = computed(() => rows.value.filter((r) => r.attention).length);
const since = (days: number | null) => (days === null ? T("never") : ago(lang.value, days));
const dateText = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
</script>

<template>
  <div class="care-page care-list">
    <header class="care-head">
      <p class="eyebrow">{{ T("careTeam") }} · {{ T(roleKey) }}</p>
      <h1>{{ T("carePatientsTitle") }}</h1>
    </header>

    <div class="seg" role="tablist" :aria-label="T('patients')">
      <button role="tab" :aria-selected="tab === 'attention'" :class="{ on: tab === 'attention' }" @click="tab = 'attention'">{{ T("needsAttention") }} · {{ attentionCount }}</button>
      <button role="tab" :aria-selected="tab === 'all'" :class="{ on: tab === 'all' }" @click="tab = 'all'">{{ T("allPatients") }} · {{ rows.length }}</button>
    </div>

    <p v-if="error" class="error" role="alert">{{ errorMessage(error) }} <button class="link" @click="() => refresh()">{{ T("tryAgain") }}</button></p>
    <ul v-if="status === 'pending' && !data" class="patient-rows" aria-hidden="true">
      <li v-for="n in 3" :key="n" class="patient-row skeleton" />
    </ul>

    <ul v-else-if="shown.length" class="patient-rows">
      <li v-for="r in shown" :key="r.p.id">
        <NuxtLink :to="`/care/${r.p.id}`" class="patient-row">
          <span class="row-main">
            <b class="row-name">{{ r.p.name }}, {{ r.p.age }}</b>
            <span class="row-profile">{{ profileText(lang, r.p.profile) }}</span>
            <span class="row-signals">
              <span v-if="r.p.openAlerts && r.p.topSeverity" class="pill alert-pill" :class="r.p.topSeverity">
                <component :is="sevIcon[r.p.topSeverity]" class="ic" aria-hidden="true" /> {{ T(`sev_${r.p.topSeverity}` as TextKey) }} · {{ T("openAlertsN", { n: r.p.openAlerts }) }}
              </span>
              <span v-if="r.overdue" class="pill alert-pill medium"><CalendarClock class="ic" aria-hidden="true" /> {{ T("reviewOverdue", { n: r.overdue }) }}</span>
              <span v-if="r.missed" class="pill">{{ T("noExerciseDays", { n: r.idle ?? 0 }) }}</span>
              <span v-if="!r.attention" class="pill urgency none"><CircleCheck class="ic" aria-hidden="true" /> {{ T("noAlerts") }}</span>
            </span>
            <span class="row-meta">{{ T(`journeyStep${r.p.journeyStage}` as TextKey) }} · {{ T("trActive", { n: r.p.activeDays7 }) }}</span>
            <span class="row-meta">{{ T("lastSessionCol") }}: {{ since(r.idle) }} · {{ T("reviewOn", { date: dateText(r.p.reviewDate) }) }}</span>
          </span>
          <ChevronRight class="ic row-go" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>

    <div v-else class="empty">
      <CircleCheck class="ic empty-ic" aria-hidden="true" />
      <p>{{ T("nobodyNeeds") }}</p>
      <button class="ghost" @click="tab = 'all'">{{ T("seeAll") }}</button>
    </div>
  </div>
</template>

<style scoped>
.care-list { max-width: 760px; margin: 0 auto; }
.patient-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
/* The whole row is the link: one big target per patient (Fitts). */
.patient-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: var(--r-card); border: 1px solid var(--line); background: var(--surface); color: var(--ink); text-decoration: none; transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.patient-row:active { transform: scale(0.99); }
@media (hover: hover) and (pointer: fine) { .patient-row:hover { border-color: var(--pine); } }
.row-main { display: grid; gap: 6px; flex: 1; min-width: 0; }
.row-name { font-size: 1.0625rem; }
.row-profile { color: var(--ink-2); font-size: 0.875rem; }
.row-signals { display: flex; flex-wrap: wrap; gap: 6px; }
.row-meta { color: var(--ink-3); font-size: 0.8125rem; }
.row-go { color: var(--ink-3); }
.skeleton { height: 112px; background: var(--sunken); border-color: var(--sunken); }
.empty { display: grid; justify-items: center; gap: 10px; padding: 32px 16px; text-align: center; color: var(--ink-2); }
.empty-ic { width: 40px; height: 40px; padding: 8px; border-radius: 50%; background: var(--sunken); color: var(--pine); }
</style>
