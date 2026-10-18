<script setup lang="ts">
import { Lock, Sparkles } from "lucide-vue-next";
import { LANG_NAMES, LANGS, exercises, exerciseById, type Lang } from "#shared/exercises";
import { locale, profileText, type TextKey } from "#shared/i18n";
import { can } from "#shared/permissions";
import { bySeverity, type Brief, type CareRole, type Patient, type PlanItem } from "#shared/model";
import type { PatientStats } from "#shared/stats";

// The care team's view of one patient: alerts, AI brief, plan editor, and (full view) the record.
// `bare`: inside the record page (care/[id]), which shows the header, numbers, plan and record in its own tabs.
// `compact` is the side panel in guided scenarios.
const props = defineProps<{ patientId: string; compact?: boolean; role?: CareRole; bare?: boolean }>();
const lang = useLang();
const T = useT();
const version = useDataVersion();
const signedIn = useRole();
// Guided scenarios pass the dashboard's role; signed-in clinicians use their own account's role.
const role = computed<CareRole>(() => props.role ?? (signedIn.value === "doctor" ? "doctor" : "physio"));
const api = useApi(role);
const canExercises = computed(() => can(role.value, "plan.exercises"));
const canLimits = computed(() => can(role.value, "plan.limits"));

const data = ref<{ patient: Patient; stats: PatientStats } | null>(null);
const error = ref("");
async function load() {
  try {
    error.value = "";
    data.value = await api(`/api/patients/${props.patientId}`);
  } catch (e) {
    error.value = errorMessage(e);
  }
}
onMounted(load);
watch(version, load);
const p = computed(() => data.value?.patient);
const stats = computed(() => data.value?.stats);

/** Runs a change and reloads. Returns whether it worked, so callers never report success after a failure. */
async function act(work: () => Promise<unknown>): Promise<boolean> {
  error.value = "";
  try {
    await work();
    version.value++;
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    return false;
  }
}

const roleName = (r: string) => T(r === "doctor" ? "roleDoctor" : r === "physio" ? "rolePhysio" : "rolePatient");
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });

// Alerts
const openAlerts = computed(() => (p.value?.alerts ?? []).filter((a) => !a.resolvedAt).sort(bySeverity));
const resolve = (alertId: string) => act(() => api(`/api/patients/${props.patientId}/alerts/${alertId}`, { method: "PATCH", body: { role: role.value } }));

// Pain chart
const painSeries = computed(() => (p.value?.sessions ?? []).filter((s) => s.painAfter !== null).slice(-10));

// Brief
const briefLang = ref<Lang>(lang.value);
watch(lang, (l) => (briefLang.value = l));
const briefText = ref("");
const briefBusy = ref(false);
watch(() => p.value?.brief.text, (text) => (briefText.value = text ?? ""), { immediate: true });
async function generateBrief() {
  briefBusy.value = true;
  await act(() => api<{ brief: Brief }>(`/api/patients/${props.patientId}/brief`, { method: "POST", body: { lang: briefLang.value } }));
  briefBusy.value = false;
}
const saveBrief = () => act(() => api(`/api/patients/${props.patientId}/brief`, { method: "PUT", body: { text: briefText.value } }));

// Plan editor: a working copy saved as a new version
const draft = reactive<{ items: PlanItem[]; note: string; painThreshold: number; reviewDate: string }>({ items: [], note: "", painThreshold: 7, reviewDate: "" });
const editing = ref(false);
const justSaved = ref(false);
function editPlan() {
  const plan = p.value!.plan;
  Object.assign(draft, { items: plan.items.map((i) => ({ ...i })), note: plan.note, painThreshold: plan.painThreshold, reviewDate: plan.reviewDate });
  editing.value = true;
  justSaved.value = false;
}
const addExercise = (exerciseId: string) => {
  const e = exerciseById(exerciseId);
  if (e && !draft.items.some((i) => i.exerciseId === exerciseId)) draft.items.push({ exerciseId, sets: e.sets, reps: e.reps });
};
const unused = computed(() => exercises.filter((e) => !draft.items.some((i) => i.exerciseId === e.id)));
// BUG-01: the editor closes and says "saved" only after the server confirms; on failure the draft stays.
const savingPlan = ref(false);
const planError = ref("");
async function savePlan() {
  savingPlan.value = true;
  planError.value = "";
  const ok = await act(() => api(`/api/patients/${props.patientId}/plan`, { method: "PUT", body: { ...draft, role: role.value } }));
  savingPlan.value = false;
  if (ok) {
    editing.value = false;
    justSaved.value = true;
  } else planError.value = error.value;
}

const setsDone = (s: Patient["sessions"][number]) => `${s.exercises.reduce((n, e) => n + e.logged.filter((v) => v !== null).length, 0)}/${s.exercises.reduce((n, e) => n + e.sets, 0)}`;
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <div v-if="p && stats" class="care-panel">
    <header v-if="!bare" class="care-head">
      <p class="eyebrow">{{ T("careTeam") }} · {{ roleName(role) }}</p>
      <h2>{{ p.name }}, {{ p.age }}</h2>
      <p class="hint">{{ profileText(lang, p.profile) }}</p>
    </header>

    <div class="care-bento">
    <dl v-if="!bare" class="stats">
      <div><dt>{{ T("adherence") }}</dt><dd>{{ stats.setAdherencePct ?? "–" }}%</dd></div>
      <div><dt>{{ T("avgPainAfter") }}</dt><dd>{{ stats.avgPainAfter ?? "–" }}</dd></div>
      <div><dt>{{ T("phantomLast") }}</dt><dd>{{ stats.phantomPainLast ?? "–" }}</dd></div>
      <div><dt>{{ T("sessions") }}</dt><dd>{{ stats.sessions }}</dd></div>
    </dl>

    <section class="tile wide">
      <span class="tile-label">{{ T("alerts") }}</span>
      <ul class="alerts">
        <li v-for="a in openAlerts" :key="a.id">
          <span class="pill alert-pill" :class="a.severity">{{ T(`sev_${a.severity}` as TextKey) }}</span>
          <span class="msg"><b>{{ T(`kind_${a.kind}` as TextKey) }}</b> · {{ a.message }} <span class="hint">· {{ day(a.at) }} · {{ T("forRoles", { who: a.for.map(roleName).join(" & ") }) }}</span></span>
          <button v-if="can(role, 'alert.resolve', { alert: a })" class="ghost small-btn" @click="resolve(a.id)">{{ T("markHandled") }}</button>
        </li>
        <li v-if="!openAlerts.length" class="hint">{{ T("noAlerts") }}</li>
      </ul>
    </section>

    <section class="tile">
      <span class="tile-label"><Sparkles class="ic" aria-hidden="true" /> {{ T("crTab_activity") }}</span>
      <CareActivity :patient="p" compact />
    </section>

    <section v-if="!bare" class="tile">
      <span class="tile-label">{{ T("pain") }}</span>
      <div class="bars">
        <div v-for="s in painSeries" :key="s.id" class="bar-col" :title="`${day(s.at)}: ${s.painBefore} → ${s.painAfter}`">
          <div class="bar-fill" :class="{ high: s.painAfter! >= p.plan.painThreshold }" :style="{ height: `${(s.painAfter! / 10) * 100}%` }" />
          <span>{{ s.painAfter }}</span>
        </div>
      </div>
    </section>

    <section v-if="!compact || p.checkIns.length" class="tile wide">
      <CareCheckIns :patient="p" :role="role" :compact="compact" @patch="(x) => p && Object.assign(p, x)" />
    </section>

    <section class="tile wide">
      <div class="bar">
        <h3 class="with-ic"><Sparkles class="ic" aria-hidden="true" /> {{ T("aiBrief") }}</h3>
        <div class="controls">
          <select v-model="briefLang" class="auto">
            <option v-for="l in LANGS" :key="l" :value="l">{{ LANG_NAMES[l] }}</option>
          </select>
          <button class="primary" :disabled="briefBusy" @click="generateBrief">{{ briefBusy ? T("writing") : T("generate") }}</button>
        </div>
      </div>
      <p class="hint">{{ T("briefHint") }}</p>
      <div v-if="briefBusy" class="brief-writing" role="status" aria-busy="true">
        <span class="sk-line" /><span class="sk-line" /><span class="sk-line short" />
        <span class="hint">{{ T("writing") }}</span>
      </div>
      <template v-else>
        <textarea v-model="briefText" :rows="compact ? 8 : 12" :placeholder="T('briefPlaceholder')" />
        <button class="ghost" style="justify-self: start" :disabled="briefText === p.brief.text" @click="saveBrief">{{ T("saveEdits") }}</button>
      </template>
    </section>

    <section v-if="!bare" class="tile wide">
      <div class="bar">
        <h3>{{ T("plan") }} <span class="hint">{{ T("planMeta", { v: p.plan.version, date: day(p.plan.updatedAt), who: roleName(p.plan.updatedBy) }) }}</span></h3>
        <button v-if="!editing" class="ghost" @click="editPlan">{{ T("editPlan") }}</button>
      </div>
      <template v-if="!editing">
        <ul class="exercise-list">
          <li v-for="i in p.plan.items" :key="i.exerciseId"><b>{{ exerciseById(i.exerciseId)?.name[lang] }}</b> <span class="dose">{{ T("setsReps", { sets: i.sets, reps: i.reps }) }}</span></li>
        </ul>
        <p class="hint">{{ T("planSummary", { limit: p.plan.painThreshold, date: p.plan.reviewDate }) }}<template v-if="p.plan.note"> · “{{ p.plan.note }}”</template></p>
        <p v-if="justSaved" class="good-text">{{ T("planSaved") }}</p>
      </template>
      <template v-else>
        <!-- ROL-05: each role edits only what it owns; the rest is shown read-only with who sets it. -->
        <template v-if="canExercises">
          <div class="table-scroll">
            <table>
              <thead><tr><th>{{ T("exercise") }}</th><th>{{ T("sets") }}</th><th>{{ T("repsLabel") }}</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(i, n) in draft.items" :key="i.exerciseId">
                  <td>{{ exerciseById(i.exerciseId)?.name[lang] }}</td>
                  <td><input v-model.number="i.sets" class="small" type="number" min="1" max="5" inputmode="numeric" /></td>
                  <td><input v-model.number="i.reps" class="small" type="number" min="1" max="30" inputmode="numeric" /></td>
                  <td><button class="link" @click="draft.items.splice(n, 1)">{{ T("remove") }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <select v-if="unused.length" class="auto" @change="addExercise(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
            <option value="">{{ T("addExercise") }}</option>
            <option v-for="e in unused" :key="e.id" :value="e.id">{{ e.name[lang] }}</option>
          </select>
          <label class="field"><span>{{ T("noteToPatient") }}</span><input v-model="draft.note" maxlength="300" /></label>
        </template>
        <div v-else class="readonly">
          <ul class="exercise-list">
            <li v-for="i in draft.items" :key="i.exerciseId"><b>{{ exerciseById(i.exerciseId)?.name[lang] }}</b> <span class="dose">{{ T("setsReps", { sets: i.sets, reps: i.reps }) }}</span></li>
          </ul>
          <p class="hint"><Lock class="ic" aria-hidden="true" /> {{ T("setByPhysio") }}</p>
        </div>
        <div v-if="canLimits" class="row">
          <label><span>{{ T("painLimit") }}</span><input v-model.number="draft.painThreshold" type="number" min="1" max="10" inputmode="numeric" /></label>
          <label><span>{{ T("reviewDate") }}</span><input v-model="draft.reviewDate" type="date" /></label>
        </div>
        <div v-else class="readonly">
          <p>{{ T("planSummary", { limit: draft.painThreshold, date: draft.reviewDate }) }}</p>
          <p class="hint"><Lock class="ic" aria-hidden="true" /> {{ T("setByDoctor") }}</p>
        </div>
        <div class="controls">
          <button class="primary" :disabled="savingPlan" @click="savePlan">{{ savingPlan ? T("saving") : planError ? T("tryAgain") : T("saveAs", { v: p.plan.version + 1 }) }}</button>
          <button class="ghost" :disabled="savingPlan" @click="editing = false">{{ T("cancel") }}</button>
        </div>
        <p v-if="planError" class="error" role="alert">{{ T("planNotSaved") }} {{ planError }}</p>
      </template>
    </section>

    <template v-if="!compact && !bare">
      <section class="tile wide">
        <h3>{{ T("sessions") }}</h3>
        <table>
          <thead><tr><th>{{ T("date") }}</th><th>{{ T("sets") }}</th><th>{{ T("painCol") }}</th><th>{{ T("felt") }}</th><th>{{ T("outcome") }}</th></tr></thead>
          <tbody>
            <tr v-for="s in [...p.sessions].reverse().slice(0, 10)" :key="s.id">
              <td>{{ day(s.at) }}</td>
              <td>{{ setsDone(s) }}</td>
              <td :class="{ bad: (s.painAfter ?? 0) >= p.plan.painThreshold }">{{ s.painBefore ?? "–" }} → {{ s.painAfter ?? "–" }}</td>
              <td>{{ s.difficulty ? T(`diff_${s.difficulty}` as TextKey) : "–" }}</td>
              <td>{{ s.concern ? T("kind_red_flag") : T(`next_${s.nextAction.kind}` as TextKey) }}</td>
            </tr>
          </tbody>
        </table>
      </section>



        <section class="tile">
          <h3>{{ T("remembers") }}</h3>
          <ul><li v-for="m in p.memories" :key="m.id">{{ m.text }} <span class="hint">({{ m.kind }})</span></li></ul>
        </section>
        <section class="tile">
          <h3>{{ T("phantomMood") }}</h3>
          <ul><li v-for="d in [...p.diary].reverse().slice(0, 8)" :key="d.id">{{ day(d.at) }} · {{ d.kind === "phantom_pain" ? T("phantom") : d.kind.replace("_", " ") }} {{ d.score ?? "–" }}/10 <span class="hint">{{ d.note }}</span></li></ul>
        </section>
    </template>

    <section v-if="!bare" class="tile wide">
      <span class="tile-label">{{ T("skinChecks") }}</span>
      <ul class="alerts">
        <li v-for="c in [...p.skinChecks].reverse().slice(0, compact ? 2 : 10)" :key="c.id">
          <span class="pill urgency" :class="c.result.urgency">{{ T(`urgency_${c.result.urgency}` as TextKey) }}</span>
          <span class="msg">{{ day(c.at) }} · {{ c.result.careTeamNote }}</span>
        </li>
        <li v-if="!p.skinChecks.length" class="hint">{{ T("noneYet") }}</li>
      </ul>
    </section>
    </div>
  </div>
</template>

<style scoped>
.brief-writing { display: grid; gap: 10px; padding: 14px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); }
.sk-line { display: block; height: 14px; width: 92%; border-radius: var(--r-pill); background: var(--sunken); animation: brief-pulse 1.4s var(--ease-out) infinite alternate; }
.sk-line.short { width: 55%; }
@keyframes brief-pulse { from { opacity: 1; } to { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .sk-line { animation: none; } }
</style>
