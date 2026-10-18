<script setup lang="ts">
import type { Component } from "vue";
import { ChevronRight, CircleCheck, Info, Lock, OctagonAlert, RotateCw, TriangleAlert } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import { bySeverity, type Alert, type CareRole, type Patient, type Severity } from "#shared/model";
import { can } from "#shared/permissions";
import { alertText } from "#shared/rules";
import type { CareSummary } from "#shared/triage";

// Care team "Alerts" (UXA-01): every open alert across the patients this clinician looks after,
// most serious first. A physio sees alerts for the doctor too, read-only (ROL-05).
const T = useT();
const lang = useLang();
const toast = useToast();
const { account } = useSession();
const role = computed<CareRole>(() => (account.value?.role === "doctor" ? "doctor" : "physio"));
const api = useApi(role);
const list = useAsyncData("care-patients", () => api<{ patients: CareSummary[]; now: number }>("/api/patients"), { server: false });

type Row = { alert: Alert; patient: Pick<Patient, "id" | "name"> };
const rows = ref<Row[] | null>(null);
const loadError = ref("");
const partial = ref(false);
async function load() {
  loadError.value = "";
  try {
    const summaries = list.data.value?.patients ?? (await api<{ patients: CareSummary[] }>("/api/patients")).patients;
    const withAlerts = summaries.filter((s) => s.openAlerts);
    const got = await Promise.allSettled(withAlerts.map((s) => api<{ patient: Patient }>(`/api/patients/${s.id}`)));
    partial.value = got.some((g) => g.status === "rejected");
    rows.value = got
      .flatMap((g) => (g.status === "fulfilled" ? g.value.patient.alerts.filter((a) => !a.resolvedAt).map((a) => ({ alert: a, patient: { id: g.value.patient.id, name: g.value.patient.name } })) : []))
      .sort((a, b) => bySeverity(a.alert, b.alert) || b.alert.at.localeCompare(a.alert.at));
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(load);

const filter = ref<"mine" | "all">("mine");
const mine = computed(() => (rows.value ?? []).filter((r) => r.alert.for.includes(role.value)));
const shown = computed(() => (filter.value === "mine" ? mine.value : rows.value ?? []));
const sevIcon: Record<Severity, Component> = { urgent: OctagonAlert, high: TriangleAlert, medium: TriangleAlert, low: Info };
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
const roleName = (r: CareRole) => T(r === "doctor" ? "roleDoctor" : "rolePhysio");

const busy = ref<string | null>(null);
async function setHandled(r: Row, handled: boolean) {
  busy.value = r.alert.id;
  try {
    await api(`/api/patients/${r.patient.id}/alerts/${r.alert.id}`, { method: "PATCH", body: handled ? {} : { reopen: true } });
    if (handled) {
      rows.value = (rows.value ?? []).filter((x) => x.alert.id !== r.alert.id);
      toast.show(T("alertHandledToast"), { tone: "good", undo: () => setHandled(r, false) });
    } else {
      rows.value = [...(rows.value ?? []), r].sort((a, b) => bySeverity(a.alert, b.alert) || b.alert.at.localeCompare(a.alert.at));
    }
    refreshNuxtData("care-patients");
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="care-page al-page">
    <header class="care-head">
      <p class="eyebrow">{{ T("careTeam") }} · {{ roleName(role) }}</p>
      <h1>{{ T("alertsTitle") }}</h1>
    </header>

    <div v-if="loadError" class="card stack" role="alert">
      <p class="error">{{ loadError }}</p>
      <button class="primary" @click="load"><RotateCw class="ic" aria-hidden="true" /> {{ T("tryAgain") }}</button>
    </div>

    <template v-else-if="rows">
      <div class="seg" role="tablist" :aria-label="T('careTabAlerts')">
        <button role="tab" :aria-selected="filter === 'mine'" :class="{ on: filter === 'mine' }" @click="filter = 'mine'">{{ T("alertsForMe", { n: mine.length }) }}</button>
        <button role="tab" :aria-selected="filter === 'all'" :class="{ on: filter === 'all' }" @click="filter = 'all'">{{ T("alertsAllOpen", { n: rows.length }) }}</button>
      </div>
      <p v-if="partial" class="hint" role="status">{{ T("alertsLoadSome") }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>

      <ul v-if="shown.length" class="al-list">
        <li v-for="r in shown" :key="r.alert.id" class="al-row">
          <span class="al-top">
            <span class="pill alert-pill" :class="r.alert.severity"><component :is="sevIcon[r.alert.severity]" class="ic" aria-hidden="true" /> {{ T(`sev_${r.alert.severity}` as TextKey) }}</span>
            <span class="al-meta">{{ day(r.alert.at) }} · {{ T("forRoles", { who: r.alert.for.map(roleName).join(" & ") }) }}</span>
          </span>
          <b class="al-name">{{ r.patient.name }} · {{ T(`kind_${r.alert.kind}` as TextKey) }}</b>
          <span class="al-msg">{{ alertText(lang, r.alert) }}</span>
          <span class="al-actions">
            <button v-if="can(role, 'alert.resolve', { alert: r.alert })" class="primary small-btn" :disabled="busy === r.alert.id" @click="setHandled(r, true)">
              <CircleCheck class="ic" aria-hidden="true" /> {{ T("markHandled") }}
            </button>
            <span v-else class="cr-lock"><Lock class="ic" aria-hidden="true" /> {{ T("alertOnlyDoctor") }}</span>
            <NuxtLink :to="`/care/${r.patient.id}`" class="ghost small-btn">{{ T("alertOpenRecord") }} <ChevronRight class="ic" aria-hidden="true" /></NuxtLink>
          </span>
        </li>
      </ul>
      <div v-else class="empty">
        <CircleCheck class="ic empty-ic" aria-hidden="true" />
        <p>{{ filter === "mine" ? T("alertsNoneForMe") : T("noAlerts") }}</p>
        <NuxtLink to="/care/patients" class="ghost small-btn">{{ T("seeAll") }}</NuxtLink>
      </div>
    </template>

    <ul v-else class="al-list" aria-busy="true">
      <li v-for="n in 3" :key="n" class="al-skel" />
    </ul>
  </div>
</template>

<style scoped>
.al-page { max-width: 760px; margin: 0 auto; }
.al-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.al-row { display: grid; gap: 6px; padding: 14px 16px; border-radius: var(--r-card); border: 1px solid var(--line); background: var(--surface); min-width: 0; }
.al-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.al-meta { font-size: 0.8125rem; color: var(--ink-3); }
.al-name { font-size: 1.0625rem; }
.al-msg { color: var(--ink-2); }
.al-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px; }
.al-actions .small-btn { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
.cr-lock { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--ink-3); }
.cr-lock .ic { width: 14px; height: 14px; }
.al-skel { height: 132px; border-radius: var(--r-card); background: var(--sunken); }
.empty { display: grid; justify-items: center; gap: 10px; padding: 32px 16px; text-align: center; color: var(--ink-2); }
.empty-ic { width: 40px; height: 40px; padding: 8px; border-radius: 50%; background: var(--sunken); color: var(--pine); }
</style>
