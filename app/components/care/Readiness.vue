<script setup lang="ts">
import { BadgeCheck, CircleCheck, CircleDashed, CircleHelp, Footprints, Lock, Pencil, TrendingUp } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import { CRITERIA, READINESS_STATUSES, type CareRole, type Criterion, type Patient, type ReadinessItem, type ReadinessStatus } from "#shared/model";
import { allMet, canSet, metCount, readinessNow } from "#shared/readiness";
import { can } from "#shared/permissions";

// Readiness Radar (DOK-03, FIS-07): seven criteria for prosthesis fitting. Automatic rows come from
// the patient's own data and never reach "met"; a clinician marks the rest. Rows this role may not
// set are read-only. The doctor clears for fitting (journey step 3) and later marks step 5.
const props = defineProps<{ patient: Patient; role: CareRole }>();
const emit = defineEmits<{ patch: [Partial<Patient>] }>();
const api = useApi(() => props.role);
const T = useT();
const lang = useLang();
const toast = useToast();

const r = computed(() => readinessNow(props.patient, Date.now()));
const met = computed(() => metCount(r.value));
const everyMet = computed(() => allMet(r.value));
const canClear = computed(() => can(props.role, "readiness.clear"));
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short", year: "numeric" });
const critName = (c: Criterion) => T(`rdCrit_${c}` as TextKey);
const statusName = (s: ReadinessStatus) => T(`rdStatus_${s}` as TextKey);
const ICON = { met: CircleCheck, progressing: TrendingUp, not_yet: CircleDashed, not_assessed: CircleHelp } as const;

type Result = Pick<Patient, "readiness" | "readinessLog" | "clearedForFittingAt" | "clearedNote" | "goalReachedAt">;
const busy = ref(false);
async function send(path: string, method: "PUT" | "POST" | "DELETE", body?: Record<string, unknown>) {
  busy.value = true;
  try {
    const res = await api<Result>(`/api/patients/${props.patient.id}/readiness/${path}`, { method, body });
    emit("patch", res);
    return true;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
    return false;
  } finally {
    busy.value = false;
  }
}

// Edit one criterion: status menu + optional note. Undo puts the row back as it was.
const editing = ref<Criterion | null>(null);
const form = reactive<{ status: ReadinessStatus | "auto"; note: string }>({ status: "not_assessed", note: "" });
function edit(c: Criterion) {
  const item = r.value[c];
  Object.assign(form, { status: item.source === "auto" ? "auto" : item.status, note: item.note });
  editing.value = c;
}
const restoreBody = (item: ReadinessItem) => (item.source === "auto" ? { status: "auto" } : { status: item.status, note: item.note });
async function save() {
  const c = editing.value;
  if (!c) return;
  const before = r.value[c];
  if (!(await send(c, "PUT", { status: form.status, note: form.status === "auto" ? "" : form.note.trim() }))) return;
  editing.value = null;
  toast.show(T("rdSaved", { criterion: critName(c), status: statusName(r.value[c].status) }), { tone: "good", undo: () => void send(c, "PUT", restoreBody(before)) });
}

// Doctor: clearance (override needs a reason) and journey step 5.
const reason = ref("");
const clearReady = computed(() => everyMet.value || reason.value.trim().length > 0);
async function clear() {
  if (!(await send("clear", "POST", { reason: everyMet.value ? "" : reason.value.trim() }))) return;
  reason.value = "";
  toast.show(T("rdClearedToast"), { tone: "good", undo: () => void send("clear", "DELETE") });
}
const unclear = () => send("clear", "DELETE");
async function goal() {
  if (!(await send("clear", "POST", { step: "goal" }))) return;
  toast.show(T("rdGoalToast"), { tone: "good", undo: () => void send("clear?step=goal", "DELETE") });
}
const ungoal = () => send("clear?step=goal", "DELETE");
</script>

<template>
  <section class="card rd">
    <header class="rd-head">
      <h2 class="cr-h">{{ T("rdTitle", { n: met }) }}</h2>
      <div class="rd-ticks" role="img" :aria-label="T('rdTitle', { n: met })">
        <span v-for="c in CRITERIA" :key="c" :class="r[c].status" />
      </div>
    </header>

    <ul class="rd-list">
      <li v-for="c in CRITERIA" :key="c" class="rd-row">
        <span class="rd-status" :class="r[c].status"><component :is="ICON[r[c].status]" class="ic" aria-hidden="true" /> {{ statusName(r[c].status) }}</span>
        <div class="rd-main">
          <p class="rd-label">
            <b>{{ critName(c) }}</b>
            <span class="pill rd-src" :class="r[c].source">{{ T(`rdSrc_${r[c].source}` as TextKey) }}</span>
          </p>
          <p v-if="r[c].evidence.length" class="rd-chips">
            <NuxtLink v-for="(e, i) in r[c].evidence" :key="i" class="chip sky" :to="evidenceLink(patient.id, e)">{{ e.label }}</NuxtLink>
          </p>
          <p v-else-if="r[c].source === 'auto'" class="cr-meta">{{ T("rdNoEvidence") }}</p>
          <p v-if="r[c].note" class="rd-note">“{{ r[c].note }}”</p>
          <p v-if="r[c].source !== 'auto' && r[c].setAt" class="cr-meta">{{ T(`rdSrc_${r[c].source}` as TextKey) }} · {{ day(r[c].setAt!) }}</p>
        </div>
        <button v-if="canSet(role, c)" class="ghost small-btn" :disabled="busy" @click="edit(c)"><Pencil class="ic" aria-hidden="true" /> {{ T("rdChange") }}</button>
        <span v-else class="cr-lock"><Lock class="ic" aria-hidden="true" /> {{ T("rdDoctorOnly") }}</span>
      </li>
    </ul>

    <div class="rd-decide">
      <template v-if="patient.clearedForFittingAt">
        <p class="rd-done"><BadgeCheck class="ic" aria-hidden="true" /> <b>{{ T("rdClearedAt", { date: day(patient.clearedForFittingAt) }) }}</b></p>
        <p v-if="patient.clearedNote" class="rd-note">“{{ patient.clearedNote }}”</p>
        <button v-if="canClear" class="link" :disabled="busy" @click="unclear">{{ T("undo") }}</button>
      </template>
      <template v-else-if="canClear">
        <label v-if="!everyMet" class="field">
          <span>{{ T("rdClearReason") }}</span>
          <textarea v-model="reason" rows="2" maxlength="300" />
        </label>
        <button class="primary" :disabled="busy || !clearReady" @click="clear"><BadgeCheck class="ic" aria-hidden="true" /> {{ T("rdClear") }}</button>
      </template>

      <template v-if="patient.goalReachedAt">
        <p class="rd-done"><Footprints class="ic" aria-hidden="true" /> <b>{{ T("rdGoalAt", { date: day(patient.goalReachedAt) }) }}</b></p>
        <button v-if="canClear" class="link" :disabled="busy" @click="ungoal">{{ T("undo") }}</button>
      </template>
      <template v-else-if="canClear">
        <button v-if="patient.profile.stage === 'prosthetic'" class="ghost" :disabled="busy" @click="goal"><Footprints class="ic" aria-hidden="true" /> {{ T("rdGoal") }}</button>
        <p v-else class="cr-meta">{{ T("rdGoalLater") }}</p>
      </template>
    </div>

    <UiSheet :open="!!editing" :title="editing ? critName(editing) : ''" @close="editing = null">
      <form v-if="editing" class="stack rd-form" @submit.prevent="save">
        <div class="rd-options" role="radiogroup" :aria-label="critName(editing)">
          <label v-for="s in READINESS_STATUSES" :key="s" class="rd-option" :class="{ on: form.status === s }">
            <input v-model="form.status" type="radio" name="rd-status" :value="s" />
            <component :is="ICON[s]" class="ic" aria-hidden="true" /> {{ statusName(s) }}
          </label>
          <label class="rd-option" :class="{ on: form.status === 'auto' }">
            <input v-model="form.status" type="radio" name="rd-status" value="auto" />
            <CircleDashed class="ic" aria-hidden="true" /> {{ T("rdAuto") }}
          </label>
        </div>
        <p v-if="form.status === 'auto'" class="cr-meta">{{ T("rdAutoHint") }}</p>
        <label v-else class="field">
          <span>{{ T("rdNote") }}</span>
          <textarea v-model="form.note" rows="3" maxlength="300" />
        </label>
        <button class="primary" :disabled="busy">{{ T("save") }}</button>
      </form>
    </UiSheet>
  </section>
</template>

<style scoped>
.rd { display: grid; gap: 14px; }
.rd-head { display: grid; gap: 10px; }
/* Kit TickMeter: one segment per criterion, filled by its status. */
.rd-ticks { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.rd-ticks span { height: 8px; border-radius: var(--r-pill); background: var(--sunken); transition: background-color var(--dur) var(--ease-out); }
.rd-ticks .met { background: var(--pine); }
.rd-ticks .progressing { background: var(--pine-light); }
.rd-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.rd-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; align-items: start; padding: 12px; border-radius: 14px; background: var(--canvas); }
.rd-status { grid-column: 1 / -1; justify-self: start; display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 3px 10px; border-radius: var(--r-pill); font-size: 0.8125rem; font-weight: 700; background: var(--sunken); color: var(--ink-2); }
.rd-status .ic { width: 16px; height: 16px; }
.rd-status.met { background: var(--good-soft); color: var(--good-ink); }
.rd-status.progressing { background: var(--info-soft); color: var(--info-ink); }
.rd-status.not_yet { background: var(--attention-soft); color: var(--attention-ink); }
.rd-main { display: grid; gap: 6px; min-width: 0; }
.rd-label { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rd-src.physio { background: var(--info-soft); color: var(--role-physio); }
.rd-src.doctor { background: color-mix(in srgb, var(--role-doctor) 12%, var(--surface)); color: var(--role-doctor); }
.rd-chips { margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.rd-chips .chip { text-decoration: none; }
.rd-note { margin: 0; color: var(--ink-2); overflow-wrap: anywhere; }
.rd-decide { display: grid; gap: 10px; padding-top: 4px; border-top: 1px solid var(--line); }
.rd-decide .field textarea { width: 100%; }
.rd-done { margin: 0; display: flex; gap: 8px; align-items: center; color: var(--good-ink); }
.rd-decide .link { justify-self: start; }
.rd-form textarea { width: 100%; }
.rd-options { display: grid; gap: 8px; }
.rd-option { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 10px 14px; border: 1px solid var(--line-strong); border-radius: 12px; cursor: pointer; font-weight: 600; transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out); }
.rd-option input { width: 20px; height: 20px; margin: 0; min-height: 0; accent-color: var(--pine); }
.rd-option.on { border-color: var(--pine); background: var(--pine-soft); }
</style>
