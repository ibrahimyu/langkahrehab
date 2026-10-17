<script setup lang="ts">
import { GitCompare, Lock, Minus, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { POSITIONS, exercises, exerciseById, firstSentence, howTo, misfit } from "#shared/exercises";
import { limbsOf } from "#shared/limbs";
import { locale, type TextKey } from "#shared/i18n";
import { can } from "#shared/permissions";
import { planDiff, type PlanChange } from "#shared/planDiff";
import type { CareRole, Patient, Plan, PlanItem } from "#shared/model";

// The plan (FIS-04) and its versions (FIS-05). The physio edits exercises and doses within the
// doctor's limits; the doctor sees them read-only and sets limits on the Profile tab.
const props = defineProps<{ patient: Patient; role: CareRole }>();
const emit = defineEmits<{ reload: [] }>();
const api = useApi(() => props.role);
const T = useT();
const lang = useLang();
const toast = useToast();
const plan = computed(() => props.patient.plan);
const canEdit = computed(() => can(props.role, "plan.exercises"));
const maxSets = computed(() => plan.value.maxSets ?? 5);
const maxReps = computed(() => plan.value.maxReps ?? 30);

const name = (id: string) => exerciseById(id)?.name[lang.value] ?? id;
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short", year: "numeric" });
const roleName = (r: string) => T(r === "doctor" ? "roleDoctor" : r === "physio" ? "rolePhysio" : "rolePatient");

// ---- Editor: a working copy; the server confirms before it says "saved" (BUG-01) ----
const editing = ref(false);
const draft = reactive<{ items: PlanItem[]; note: string }>({ items: [], note: "" });
function edit() {
  Object.assign(draft, { items: plan.value.items.map((i) => ({ ...i })), note: plan.value.note });
  saveError.value = "";
  editing.value = true;
}
const unused = computed(() => exercises.filter((e) => !draft.items.some((i) => i.exerciseId === e.id)));
// Picker (FIS-04): grouped by position, with why an exercise does not fit this patient's limbs.
const picking = ref(false);
const fitsOnly = ref(true);
const limbs = computed(() => limbsOf(props.patient.profile));
const MISFIT_TEXT = { needs_knee: "exNeedsKnee", needs_elbow: "exNeedsElbow", other_limb: "exOtherLimb" } as const;
const pickGroups = computed(() =>
  POSITIONS.map((pos) => ({
    pos,
    items: unused.value
      .filter((e) => e.position === pos)
      .map((e) => ({ e, how: firstSentence(howTo(e, lang.value, props.patient.profile)), misfit: misfit(e, limbs.value) }))
      .filter((x) => !fitsOnly.value || !x.misfit),
  })).filter((g) => g.items.length),
);
function addExercise(id: string) {
  const e = exerciseById(id);
  if (e) draft.items.push({ exerciseId: id, sets: Math.min(e.sets, maxSets.value), reps: Math.min(e.reps, maxReps.value) });
  picking.value = false;
}
const step = (i: PlanItem, field: "sets" | "reps", by: number) => {
  const max = field === "sets" ? maxSets.value : maxReps.value;
  i[field] = Math.min(max, Math.max(1, i[field] + by));
};
const changes = computed(() => (editing.value ? planDiff(plan.value, { ...plan.value, ...draft }) : []));
const overLimit = computed(() => draft.items.some((i) => i.sets > maxSets.value || i.reps > maxReps.value));
const saving = ref(false);
const saveError = ref("");
async function save() {
  saving.value = true;
  saveError.value = "";
  const before = { items: plan.value.items.map((i) => ({ ...i })), note: plan.value.note };
  try {
    const saved = await api<Plan>(`/api/patients/${props.patient.id}/plan`, { method: "PUT", body: { items: draft.items, note: draft.note } });
    editing.value = false;
    emit("reload");
    toast.show(T("crSavedAs", { v: saved.version }), {
      tone: "good",
      undo: async () => {
        try {
          await api(`/api/patients/${props.patient.id}/plan`, { method: "PUT", body: before });
          emit("reload");
        } catch (e) {
          toast.show(errorMessage(e), { tone: "bad" });
        }
      },
    });
  } catch (e) {
    saveError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

// ---- Versions: newest first, each one comparable with the one before ----
const versions = computed(() => [plan.value, ...[...props.patient.planHistory].reverse()]);
const comparing = ref<number | null>(null);
const diffFor = (v: Plan) => {
  const prev = props.patient.planHistory.find((h) => h.version === v.version - 1);
  return prev ? planDiff(prev, v) : null;
};
function changeText(c: PlanChange) {
  if (c.kind === "added") return `+ ${name(c.exerciseId)} · ${T("setsReps", { sets: c.sets, reps: c.reps })}`;
  if (c.kind === "removed") return `− ${name(c.exerciseId)}`;
  if (c.kind === "dose") return `${name(c.exerciseId)} · ${T(c.field === "sets" ? "sets" : "repsLabel")} ${c.from} → ${c.to}`;
  if (c.kind === "limit") return `${T(`crLimit_${c.field}` as TextKey)} ${c.from} → ${c.to}`;
  return `${T("noteToPatient")}: “${c.to || "–"}”`;
}
</script>

<template>
  <section class="cr-section">
    <!-- Current plan -->
    <article v-if="!editing" class="card cr-item">
      <div class="cr-top">
        <h2 class="cr-h">{{ T("plan") }} <span class="pill">v{{ plan.version }}</span></h2>
        <button v-if="canEdit" class="primary small-btn" @click="edit"><Pencil class="ic" aria-hidden="true" /> {{ T("editPlan") }}</button>
      </div>
      <p class="cr-meta">{{ day(plan.updatedAt) }} · {{ roleName(plan.updatedBy) }} · {{ T(`crSource_${plan.source ?? "manual"}` as TextKey) }}</p>
      <ul class="cr-ex">
        <li v-for="i in plan.items" :key="i.exerciseId">
          <b>{{ name(i.exerciseId) }}</b>
          <span class="cr-dose" :class="{ over: i.sets > maxSets || i.reps > maxReps }">{{ T("setsReps", { sets: i.sets, reps: i.reps }) }}</span>
        </li>
      </ul>
      <p v-if="plan.note" class="cr-note-line">“{{ plan.note }}”</p>
      <p v-if="!canEdit" class="cr-lock"><Lock class="ic" aria-hidden="true" /> {{ T("setByPhysio") }}</p>
      <dl class="cr-limits">
        <div><dt>{{ T("painLimit") }}</dt><dd>{{ plan.painThreshold }}</dd></div>
        <div><dt>{{ T("reviewDate") }}</dt><dd>{{ plan.reviewDate }}</dd></div>
        <div><dt>{{ T("crMaxDose") }}</dt><dd>{{ plan.maxSets ?? "–" }} × {{ plan.maxReps ?? "–" }}</dd></div>
      </dl>
      <p class="cr-lock"><Lock class="ic" aria-hidden="true" /> {{ T("setByDoctor") }}</p>
    </article>

    <!-- Editor (physio) -->
    <form v-else class="card cr-item" @submit.prevent="save">
      <h2 class="cr-h">{{ T("editPlan") }}</h2>
      <ul class="cr-list">
        <li v-for="(i, n) in draft.items" :key="i.exerciseId" class="cr-edit-row">
          <b class="cr-edit-name">{{ name(i.exerciseId) }}</b>
          <div class="cr-steppers">
            <div v-for="f in (['sets', 'reps'] as const)" :key="f" class="cr-stepper">
              <span class="cr-meta">{{ T(f === "sets" ? "sets" : "repsLabel") }} <span v-if="(f === 'sets' ? plan.maxSets : plan.maxReps)">· {{ T("crMaxN", { n: f === "sets" ? maxSets : maxReps }) }}</span></span>
              <div class="cr-step">
                <button type="button" class="ghost" :aria-label="`${T(f === 'sets' ? 'sets' : 'repsLabel')} −1`" :disabled="i[f] <= 1" @click="step(i, f, -1)"><Minus class="ic" aria-hidden="true" /></button>
                <input v-model.number="i[f]" type="number" min="1" :max="f === 'sets' ? maxSets : maxReps" inputmode="numeric" :aria-label="`${name(i.exerciseId)} ${T(f === 'sets' ? 'sets' : 'repsLabel')}`" />
                <button type="button" class="ghost" :aria-label="`${T(f === 'sets' ? 'sets' : 'repsLabel')} +1`" :disabled="i[f] >= (f === 'sets' ? maxSets : maxReps)" @click="step(i, f, 1)"><Plus class="ic" aria-hidden="true" /></button>
              </div>
            </div>
          </div>
          <button type="button" class="ghost danger small-btn" :disabled="draft.items.length <= 1" @click="draft.items.splice(n, 1)"><Trash2 class="ic" aria-hidden="true" /> {{ T("remove") }}</button>
        </li>
      </ul>
      <p v-if="overLimit" class="error" role="alert">{{ T("crOverLimit", { sets: maxSets, reps: maxReps }) }}</p>
      <template v-if="unused.length && draft.items.length < 6">
        <button v-if="!picking" type="button" class="ghost small-btn cr-add" @click="picking = true"><Plus class="ic" aria-hidden="true" /> {{ T("addExercise") }}</button>
        <div v-else class="cr-picker">
          <div class="cr-top">
            <b>{{ T("addExercise") }}</b>
            <label class="cr-fits"><input v-model="fitsOnly" type="checkbox" /> {{ T("exFitsOnly") }}</label>
          </div>
          <p v-if="!pickGroups.length" class="hint">{{ T("exNoneFit") }}</p>
          <section v-for="g in pickGroups" :key="g.pos" class="cr-pick-group">
            <h3 class="cr-meta">{{ T(`pos_${g.pos}` as TextKey) }}</h3>
            <button v-for="x in g.items" :key="x.e.id" type="button" class="cr-pick" @click="addExercise(x.e.id)">
              <span class="cr-pick-main"><b>{{ x.e.name[lang] }}</b><span class="hint">{{ x.how }}</span></span>
              <span v-if="x.misfit" class="tag cr-misfit">{{ T(MISFIT_TEXT[x.misfit]) }}</span>
              <Plus class="ic" aria-hidden="true" />
            </button>
          </section>
          <button type="button" class="ghost small-btn" @click="picking = false">{{ T("cancel") }}</button>
        </div>
      </template>
      <label class="field">
        <span class="cr-top"><span>{{ T("noteToPatient") }}</span><span class="cr-meta">{{ draft.note.length }}/300</span></span>
        <textarea v-model="draft.note" rows="2" maxlength="300" />
      </label>
      <div v-if="changes.length" class="cr-diff">
        <b>{{ T("crChanges") }}</b>
        <ul><li v-for="(c, k) in changes" :key="k">{{ changeText(c) }}</li></ul>
      </div>
      <p v-if="saveError" class="error" role="alert">{{ T("planNotSaved") }} {{ saveError }}</p>
      <div class="cr-actions">
        <button class="primary" :disabled="saving || !changes.length || overLimit">{{ saving ? T("saving") : saveError ? T("tryAgain") : T("saveAs", { v: plan.version + 1 }) }}</button>
        <button type="button" class="ghost" :disabled="saving" @click="editing = false">{{ T("cancel") }}</button>
      </div>
    </form>

    <!-- Versions -->
    <h2 class="cr-h">{{ T("crVersions") }}</h2>
    <ul class="cr-list">
      <li v-for="v in versions" :key="v.version" class="card cr-item cr-version">
        <div class="cr-top">
          <span><b>v{{ v.version }}</b> <span class="cr-meta">· {{ day(v.updatedAt) }} · {{ roleName(v.updatedBy) }} · {{ T(`crSource_${v.source ?? "manual"}` as TextKey) }}</span></span>
          <button v-if="diffFor(v)" class="ghost small-btn" :aria-expanded="comparing === v.version" :class="{ 'cr-on': comparing === v.version }" @click="comparing = comparing === v.version ? null : v.version">
            <GitCompare class="ic" aria-hidden="true" /> {{ T("crCompare") }}
          </button>
        </div>
        <template v-if="comparing === v.version">
          <ul v-if="diffFor(v)!.length" class="cr-diff-list"><li v-for="(c, k) in diffFor(v)" :key="k">{{ changeText(c) }}</li></ul>
          <p v-else class="hint">{{ T("crNoChanges") }}</p>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.cr-ex { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.cr-ex li { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--canvas); }
.cr-dose { font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
.cr-dose.over { color: var(--danger-ink); font-weight: 700; }
.cr-note-line { color: var(--ink-2); overflow-wrap: anywhere; }
.cr-limits { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
.cr-limits div { padding: 8px 10px; border-radius: 12px; background: var(--sunken); min-width: 0; }
.cr-limits dt { font-size: 0.75rem; color: var(--ink-2); }
.cr-limits dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.cr-edit-row { display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: var(--canvas); }
.cr-edit-row > .ghost { justify-self: start; }
.cr-steppers { display: grid; gap: 10px; }
@media (min-width: 480px) { .cr-steppers { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.cr-stepper { display: grid; gap: 4px; min-width: 0; }
.cr-step { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 4px; }
.cr-step .ghost { min-height: 44px; padding: 0; display: grid; place-items: center; }
.cr-step input { text-align: center; min-width: 0; padding-inline: 4px; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
.cr-step input::-webkit-inner-spin-button, .cr-step input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.cr-add { justify-self: start; }
.cr-picker { display: grid; gap: 10px; padding: 12px; border-radius: 14px; background: var(--canvas); min-width: 0; }
.cr-picker > .small-btn { justify-self: start; }
.cr-fits { display: inline-flex; gap: 6px; align-items: center; font-size: 0.875rem; }
.cr-pick-group { display: grid; gap: 6px; }
.cr-pick-group h3 { margin: 0; }
.cr-pick { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; text-align: left; padding: 10px 12px; min-height: 44px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line-strong); color: var(--ink); }
.cr-pick-main { display: grid; gap: 2px; min-width: 0; }
.cr-pick-main .hint { overflow-wrap: anywhere; }
.cr-misfit { background: var(--attention-soft); color: var(--attention-ink); }
.cr-diff { padding: 12px; border-radius: 12px; background: var(--info-soft); color: var(--info-ink); display: grid; gap: 4px; }
.cr-diff ul, .cr-diff-list { margin: 0; padding-left: 18px; display: grid; gap: 2px; }
.cr-diff-list { color: var(--ink-2); }
.cr-version { padding: 12px 14px; }
</style>
