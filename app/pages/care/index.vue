<script setup lang="ts">
import { Sparkles, CalendarClock, ChevronRight, CircleCheck, OctagonAlert, Sun, TriangleAlert, Info } from "lucide-vue-next";
import type { Component } from "vue";
import type { CareRole, Severity, TriageCache } from "#shared/model";
import { triage, type CareSummary, type TriageReason, type TriageTab } from "#shared/triage";
import { ago, locale, profileText, type TextKey } from "#shared/i18n";
import { MISSED_DAYS } from "#shared/rules";

// Care team home (FIS-01): who needs you today. One row per patient (name, why, one way in),
// so it reads on a phone as well as a laptop. The order is fixed by rules: severity first.
const api = useApi();
const lang = useLang();
const T = useT();
const { data, error, status } = useAsyncData("care-patients", () => api<{ patients: CareSummary[]; now: number }>("/api/patients"), { server: false });
const { account } = useSession();
const roleKey = computed<TextKey>(() => (account.value?.role === "doctor" ? "roleDoctor" : "rolePhysio"));
const role = computed<CareRole>(() => (account.value?.role === "doctor" ? "doctor" : "physio"));

// AI-06: one AI sentence per patient; the rules keep the order. Without the AI the template reasons stay.
const triageApi = useApi(role);
const aiTriage = ref<TriageCache | null>(null);
watch([data, role, lang], async () => {
  if (!data.value) return;
  try {
    aiTriage.value = await triageApi<TriageCache>(`/api/triage?lang=${lang.value}`);
  } catch {
    aiTriage.value = null;
  }
}, { immediate: true });
const aiReason = (id: string) => (aiTriage.value?.by === "ai" ? aiTriage.value.items.find((i) => i.patientId === id) : undefined);

// Today (FIS-01): fixed order from rules (shared/triage.ts), one reason and one way in per patient.
const today = computed(() => triage(data.value?.patients ?? [], role.value, now.value));
const todayRank = computed(() => new Map(today.value.map((t, i) => [t.patient.id, i])));
function reasonText(r: TriageReason) {
  if (r.kind === "alert") return `${T(`kind_${r.alert}` as TextKey)} · ${T(`sev_${r.severity}` as TextKey)}`;
  if (r.kind === "urgent_note") return T("trUrgentNote");
  if (r.kind === "goals_ok") return T("trGoalsOk", { n: r.n });
  if (r.kind === "checkin") return T("trCheckin");
  if (r.kind === "proposal") return T("trProposal");
  if (r.kind === "letter") return r.from ? T("trLetterFrom", { name: r.from }) : T("trLetter");
  if (r.kind === "new_plan") return T("trNewPlan");
  if (r.kind === "review") return T("reviewOverdue", { n: r.days });
  if (r.kind === "missed") return T("noExerciseDays", { n: r.days });
  return T("crUnreadN", { n: r.n });
}
const actionKey: Record<TriageTab, TextKey> = { overview: "trOpen", notes: "trReadNotes", goals: "trReviewSteps", sessions: "trSeeSessions", profile: "trSetReview", plan: "trReviewPlan", visits: "trOpenVisits", intake: "trReviewLetter" };
// DOK-07: a letter from the family opens straight into the review screen.
const todayLink = (t: { patient: CareSummary; tab: TriageTab; reason: TriageReason }) =>
  t.reason.kind === "letter" ? `/care/intake/new?patient=${t.patient.id}&letter=${t.reason.letterId}` : `/care/${t.patient.id}${t.tab === "overview" ? "" : `?tab=${t.tab}`}`;

const DAY = 86_400_000;
const rank: Record<Severity, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const sevIcon: Record<Severity, Component> = { urgent: OctagonAlert, high: TriangleAlert, medium: TriangleAlert, low: Info };
const now = computed(() => data.value?.now ?? Date.now());
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
const tab = ref<"attention" | "all">("attention");
const shown = computed(() => (tab.value === "all" ? rows.value : rows.value.filter((r) => r.attention)));
const attentionCount = computed(() => rows.value.filter((r) => r.attention).length);
const since = (days: number | null) => (days === null ? T("never") : ago(lang.value, days));
const dateText = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
</script>

<template>
  <div class="care-page care-list">
    <header class="care-head">
      <p class="eyebrow">{{ T("careTeam") }} · {{ T(roleKey) }}</p>
      <h1>{{ T("whoNeedsYou") }}</h1>
    </header>

    <CareIntakeCard v-if="role === 'doctor'" />

    <section v-if="today.length" class="card today" :aria-label="T('trToday', { n: today.length })">
      <h2 class="today-title"><Sun class="ic" aria-hidden="true" /> {{ T("trToday", { n: today.length }) }}</h2>
      <p v-if="aiTriage?.by === 'ai'" class="today-ai-note">{{ T("trAiLabel") }}</p>
      <ol class="today-list">
        <li v-for="t in today" :key="t.patient.id" class="today-row">
          <span class="today-main">
            <b>{{ t.patient.name }}</b>
            <span class="today-why">{{ aiReason(t.patient.id)?.reason || reasonText(t.reason) }}</span>
            <span v-if="aiReason(t.patient.id)" class="today-ai"><Sparkles class="ic" aria-hidden="true" /> {{ T(`trAction_${aiReason(t.patient.id)!.action}` as TextKey) }}</span>
            <span class="row-signals">
              <span class="pill">{{ T("trActive", { n: t.patient.activeDays7 }) }}</span>
              <span v-if="t.patient.unreadNotes && t.reason.kind !== 'notes'" class="pill">{{ T("crUnreadN", { n: t.patient.unreadNotes }) }}</span>
            </span>
          </span>
          <NuxtLink :to="todayLink(t)" class="primary small-btn today-go">{{ T(actionKey[t.tab]) }}</NuxtLink>
        </li>
      </ol>
    </section>

    <div class="seg" role="tablist" :aria-label="T('patients')">
      <button role="tab" :aria-selected="tab === 'attention'" :class="{ on: tab === 'attention' }" @click="tab = 'attention'">{{ T("needsAttention") }} · {{ attentionCount }}</button>
      <button role="tab" :aria-selected="tab === 'all'" :class="{ on: tab === 'all' }" @click="tab = 'all'">{{ T("allPatients") }} · {{ rows.length }}</button>
    </div>

    <p v-if="error" class="error">{{ errorMessage(error) }}</p>
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
.today { display: grid; gap: 10px; background: var(--dawn-soft); box-shadow: none; }
.today-title { font-size: 1.0625rem; display: flex; align-items: center; gap: 8px; }
.today-title .ic { color: var(--dawn-ink); }
.today-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.today-row { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 14px; background: var(--surface); flex-wrap: wrap; }
.today-main { display: grid; gap: 4px; flex: 1 1 180px; min-width: 0; }
.today-why { color: var(--ink-2); font-size: 0.875rem; }
.today-ai { display: inline-flex; align-items: center; gap: 4px; font-size: 0.8125rem; font-weight: 700; color: var(--ai-ink); }
.today-ai .ic { width: 14px; height: 14px; }
.today-ai-note { margin: -4px 0 0; font-size: 0.8125rem; color: var(--ink-3); }
.today-go { min-height: 44px; text-decoration: none; display: inline-flex; align-items: center; }
.skeleton { height: 112px; background: var(--sunken); border-color: var(--sunken); }
.empty { display: grid; justify-items: center; gap: 10px; padding: 32px 16px; text-align: center; color: var(--ink-2); }
.empty-ic { width: 40px; height: 40px; padding: 8px; border-radius: 50%; background: var(--sunken); color: var(--pine); }
</style>
