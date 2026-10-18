<script setup lang="ts">
import { Sparkles, CircleCheck, Sun } from "lucide-vue-next";
import type { CareRole, TriageCache } from "#shared/model";
import { triage, type CareSummary, type TriageReason, type TriageTab } from "#shared/triage";
import type { TextKey } from "#shared/i18n";

// Care team home (FIS-01, UXA-01 "Today"): who needs you today. One row per patient (name, why,
// one way in), so it reads on a phone as well as a laptop. The order is fixed by rules: severity first.
// The full list lives on its own screen (care/patients.vue).
const api = useApi();
const lang = useLang();
const T = useT();
const { data, error, status, refresh } = useAsyncData("care-patients", () => api<{ patients: CareSummary[]; now: number }>("/api/patients"), { server: false });
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

const now = computed(() => data.value?.now ?? Date.now());
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

    <p v-if="error" class="error" role="alert">{{ errorMessage(error) }} <button class="link" @click="() => refresh()">{{ T("tryAgain") }}</button></p>
    <div v-else-if="status === 'pending' && !data" class="today-skel" aria-busy="true" />
    <div v-else-if="!today.length" class="empty">
      <CircleCheck class="ic empty-ic" aria-hidden="true" />
      <p>{{ T("careTodayClear") }}</p>
      <NuxtLink to="/care/patients" class="ghost small-btn">{{ T("seeAll") }}</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.care-list { max-width: 760px; margin: 0 auto; }
.row-signals { display: flex; flex-wrap: wrap; gap: 6px; }
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
.today-skel { height: 220px; border-radius: var(--r-card); background: var(--sunken); }
.empty { display: grid; justify-items: center; gap: 10px; padding: 32px 16px; text-align: center; color: var(--ink-2); }
.empty-ic { width: 40px; height: 40px; padding: 8px; border-radius: 50%; background: var(--sunken); color: var(--pine); }
</style>
