<script setup lang="ts">
import { ArrowLeft, MessageSquareText } from "lucide-vue-next";
import { profileText, type TextKey } from "#shared/i18n";
import type { CareRole, Patient } from "#shared/model";
import type { PatientStats } from "#shared/stats";

// One patient's record for the care team (FIS-05), split into tabs so it reads on a phone.
// The physio and the doctor get different tabs: the physio owns exercises and goal OKs, the doctor
// owns the profile and clinical limits (DOK-02).
const id = useRoute().params.id as string;
const route = useRoute();
const router = useRouter();
const signedIn = useRole();
const T = useT();
const lang = useLang();
const version = useDataVersion();
onMounted(() => {
  if (signedIn.value === "patient") signedIn.value = "physio";
});
const role = computed<CareRole>(() => (signedIn.value === "doctor" ? "doctor" : "physio"));
const api = useApi(role);

const data = ref<{ patient: Patient; stats: PatientStats } | null>(null);
const loadError = ref("");
async function load() {
  try {
    loadError.value = "";
    data.value = await api(`/api/patients/${id}`);
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(load);
watch(version, load);
const p = computed(() => data.value?.patient);
const patch = (part: Partial<Patient>) => p.value && Object.assign(p.value, part);

type Tab = "overview" | "notes" | "plan" | "goals" | "body" | "sessions" | "memories" | "profile";
const tabs = computed<Tab[]>(() =>
  role.value === "doctor"
    ? ["overview", "notes", "profile", "body", "plan", "sessions", "goals", "memories"]
    : ["overview", "notes", "plan", "goals", "body", "sessions", "memories", "profile"],
);
const tab = computed<Tab>({
  get: () => (tabs.value.includes(route.query.tab as Tab) ? (route.query.tab as Tab) : "overview"),
  set: (t) => router.replace({ query: { ...route.query, tab: t === "overview" ? undefined : t } }),
});
// Keep the chosen tab in view inside the scrolling strip (deep links such as ?tab=memories).
watch(tab, () => nextTick(() => document.querySelector(".cr-tabs .on")?.scrollIntoView({ block: "nearest", inline: "nearest" })), { flush: "post" });
onMounted(() => setTimeout(() => document.querySelector(".cr-tabs .on")?.scrollIntoView({ block: "nearest", inline: "nearest" }), 600));
const unread = computed(() => (p.value?.notes ?? []).filter((n) => !n.readAt).length);
const toDiscuss = computed(() => (p.value?.notes ?? []).filter((n) => n.discussAtVisit).length);
const goalsWaiting = computed(() => (p.value?.goals ?? []).flatMap((g) => g.targets).filter((t) => t.needsPhysioOk && !t.physioOkAt && !t.doneAt).length);
const badge = (t: Tab) => (t === "notes" ? unread.value : t === "goals" && role.value === "physio" ? goalsWaiting.value : 0);

const lastPain = computed(() => [...(p.value?.sessions ?? [])].reverse().find((s) => s.painAfter !== null)?.painAfter ?? null);
</script>

<template>
  <div class="care-page cr-page">
    <NuxtLink to="/care" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("patients") }}</NuxtLink>
    <p v-if="loadError" class="error">{{ loadError }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>

    <template v-if="!p && !loadError">
      <div class="cr-skel" style="height: 88px" />
      <div class="cr-skel" style="height: 44px" />
      <div class="cr-skel" style="height: 240px" />
    </template>

    <template v-if="p && data">
      <header class="care-head">
        <p class="eyebrow">{{ T("careTeam") }} · {{ T(role === "doctor" ? "roleDoctor" : "rolePhysio") }}</p>
        <h1 class="cr-name">{{ p.name }}, {{ p.age }}</h1>
        <p class="hint">{{ profileText(lang, p.profile) }}</p>
      </header>

      <dl class="cr-kpis">
        <div><dt>{{ T("adherence") }}</dt><dd>{{ data.stats.setAdherencePct ?? "–" }}<small>%</small></dd></div>
        <div :class="{ over: lastPain !== null && lastPain >= p.plan.painThreshold }"><dt>{{ T("crPainLast") }}</dt><dd>{{ lastPain ?? "–" }}<small> / {{ p.plan.painThreshold }}</small></dd></div>
        <div><dt>{{ T("phantomLast") }}</dt><dd>{{ data.stats.phantomPainLast ?? "–" }}</dd></div>
      </dl>

      <nav class="cr-tabs" role="tablist" :aria-label="T('crRecord')">
        <button v-for="t in tabs" :key="t" role="tab" :aria-selected="tab === t" :class="{ on: tab === t }" @click="tab = t">
          {{ T(`crTab_${t}` as TextKey) }}<span v-if="badge(t)" class="cr-count">{{ badge(t) }}</span>
        </button>
      </nav>

      <div class="cr-panel">
        <template v-if="tab === 'overview'">
          <button v-if="unread || toDiscuss" class="cr-since" @click="tab = 'notes'">
            <MessageSquareText class="ic" aria-hidden="true" />
            <span><b>{{ T("crSinceVisit") }}</b><br /><span class="hint">{{ T("crUnreadN", { n: unread }) }} · {{ T("crDiscussN", { n: toDiscuss }) }}</span></span>
          </button>
          <CarePanel :patient-id="id" :role="role" bare />
        </template>
        <CareNotes v-else-if="tab === 'notes'" :patient="p" :role="role" @patch="patch" />
        <CarePlan v-else-if="tab === 'plan'" :patient="p" :role="role" @reload="load" />
        <CareGoals v-else-if="tab === 'goals'" :patient="p" :role="role" @patch="patch" />
        <CareBody v-else-if="tab === 'body'" :patient="p" />
        <CareSessions v-else-if="tab === 'sessions'" :patient="p" />
        <CareMemories v-else-if="tab === 'memories'" :patient="p" :role="role" @patch="patch" />
        <CareProfile v-else-if="tab === 'profile'" :patient="p" :role="role" @patch="patch" @reload="load" />
      </div>
    </template>
  </div>
</template>

<style>
/* Shared by the care record tabs (app/components/care/*). */
.cr-page { max-width: 900px; margin: 0 auto; min-width: 0; }
.cr-name { font-size: 1.625rem; }
.cr-skel { border-radius: var(--r-card); background: var(--sunken); }
.cr-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
.cr-kpis div { background: var(--surface); box-shadow: var(--shadow-sm); border-radius: 14px; padding: 10px 12px; min-width: 0; }
.cr-kpis dt { font-size: 0.75rem; color: var(--ink-2); line-height: 1.25; }
.cr-kpis dd { margin: 2px 0 0; font: 700 1.5rem/1.15 var(--display); font-variant-numeric: tabular-nums; }
.cr-kpis small { font-size: 0.875rem; color: var(--ink-3); font-weight: 600; }
.cr-kpis .over { background: var(--danger-soft); }
.cr-kpis .over dd { color: var(--danger-ink); }
/* Kit SegmentedTabs, widened to a scrollable strip: eight tabs do not fit 360 px, so the strip scrolls, not the page. */
.cr-tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; background: var(--sunken); border-radius: var(--r-pill); padding: 4px; position: sticky; top: 0; z-index: 2; }
.cr-tabs::-webkit-scrollbar { display: none; }
.cr-tabs button { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 14px; border: 0; border-radius: var(--r-pill); background: none; color: var(--ink-2); font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: background-color var(--dur) var(--ease-move), color var(--dur) var(--ease-move), transform var(--dur-press) var(--ease-out); }
.cr-tabs button:active { transform: scale(0.97); }
.cr-tabs button.on { background: var(--ink); color: var(--surface); }
.cr-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: var(--r-pill); background: var(--dawn); color: var(--ink); font-size: 0.75rem; display: inline-grid; place-items: center; font-variant-numeric: tabular-nums; }
.cr-panel { display: grid; gap: 14px; min-width: 0; animation: pop-in var(--dur) var(--ease-out) both; }
.cr-since { display: flex; align-items: center; gap: 12px; text-align: left; padding: 14px 16px; border: 0; border-radius: var(--r-card); background: var(--dawn-soft); color: var(--ink); cursor: pointer; font: inherit; transition: transform var(--dur-press) var(--ease-out); }
.cr-since:active { transform: scale(0.99); }
.cr-since .ic { color: var(--dawn-ink); flex: none; }
.cr-section { display: grid; gap: 10px; min-width: 0; }
.cr-section > h2, .cr-h { font-size: 1.125rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cr-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.cr-item { display: grid; gap: 8px; min-width: 0; }
.cr-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.cr-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.cr-actions .ghost, .cr-actions .primary { min-height: 44px; }
.cr-on { background: var(--ink) !important; color: var(--surface) !important; border-color: var(--ink) !important; }
.cr-lock { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--ink-3); }
.cr-lock .ic { width: 14px; height: 14px; }
.cr-empty { display: grid; justify-items: center; gap: 10px; padding: 28px 16px; text-align: center; color: var(--ink-2); }
.cr-empty .ic { width: 40px; height: 40px; padding: 8px; border-radius: 50%; background: var(--sunken); color: var(--pine); }
.cr-meta { font-size: 0.8125rem; color: var(--ink-3); }
.cr-grid { display: grid; gap: 12px; }
@media (min-width: 720px) { .cr-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
