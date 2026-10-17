<script setup lang="ts">
import { CircleCheck, Hourglass, Plus, ShieldCheck, Star, Target, Trash2 } from "lucide-vue-next";
import { type TextKey } from "#shared/i18n";
import { can } from "#shared/permissions";
import type { CareRole, Goal, Patient, Target as GoalTarget } from "#shared/model";

// The patient's goals seen by the care team (PAS-14). The physio gives the OK for steps that load the
// body, and may add or remove their own steps; the doctor reads.
const props = defineProps<{ patient: Patient; role: CareRole }>();
const emit = defineEmits<{ patch: [Partial<Patient>] }>();
const api = useApi(() => props.role);
const T = useT();
const toast = useToast();
const canEdit = computed(() => can(props.role, "goal.edit"));
const goals = computed(() => [...props.patient.goals].sort((a, b) => Number(b.main) - Number(a.main)));

const busy = ref(false);
async function put(next: Goal[]) {
  busy.value = true;
  try {
    emit("patch", { goals: await api<Goal[]>(`/api/patients/${props.patient.id}/goals`, { method: "PUT", body: { goals: next } }) });
    return true;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
    return false;
  } finally {
    busy.value = false;
  }
}
/** Saves a changed copy; Undo puts the previous list back. */
async function change(edit: (gs: Goal[]) => void, done: TextKey) {
  const before = structuredClone(toRaw(props.patient.goals));
  const next = structuredClone(toRaw(props.patient.goals));
  edit(next);
  if (await put(next)) toast.show(T(done), { tone: "good", undo: () => void put(before) });
}
const target = (gs: Goal[], gid: string, tid: string) => gs.find((g) => g.id === gid)!.targets.find((t) => t.id === tid)!;
const setOk = (g: Goal, t: GoalTarget, ok: boolean) =>
  change((gs) => (target(gs, g.id, t.id).physioOkAt = ok ? new Date().toISOString() : null), ok ? "crOkGiven" : "crOkWithdrawn");
const removeStep = (g: Goal, t: GoalTarget) => change((gs) => {
  const goal = gs.find((x) => x.id === g.id)!;
  goal.targets = goal.targets.filter((x) => x.id !== t.id);
}, "stepDeleted");

const stepText = reactive<Record<string, string>>({});
async function addStep(g: Goal) {
  const text = (stepText[g.id] ?? "").trim();
  if (!text) return;
  await change((gs) => gs.find((x) => x.id === g.id)!.targets.push({ id: "", text, needsPhysioOk: false, physioOkAt: null, doneAt: null, targetMonth: null, source: "physio" }), "crStepAdded");
  stepText[g.id] = "";
}
const goalText = ref("");
async function addGoal() {
  const text = goalText.value.trim();
  if (!text) return;
  await change((gs) => gs.push({ id: "", text, area: "other", main: !gs.length, createdAt: "", createdVia: "care_team", targets: [] }), "crGoalAdded");
  goalText.value = "";
}
const waiting = (t: GoalTarget) => t.needsPhysioOk && !t.physioOkAt;
</script>

<template>
  <section class="cr-section">
    <h2>{{ T("tabGoals") }}</h2>
    <ul v-if="goals.length" class="cr-list">
      <li v-for="g in goals" :key="g.id" class="card cr-item">
        <div class="cr-top">
          <span class="cr-actions">
            <span v-if="g.main" class="pill cr-main"><Star class="ic" aria-hidden="true" /> {{ T("mainGoal") }}</span>
            <span class="pill">{{ T(`area_${g.area}` as TextKey) }}</span>
          </span>
        </div>
        <p class="cr-goal">{{ g.text }}</p>
        <ul v-if="g.targets.length" class="cr-list cr-targets">
          <li v-for="t in g.targets" :key="t.id" class="cr-target" :class="{ waiting: waiting(t) }">
            <span class="cr-t-ic">
              <CircleCheck v-if="t.doneAt" class="ic done" aria-hidden="true" />
              <Hourglass v-else-if="waiting(t)" class="ic" aria-hidden="true" />
              <Target v-else class="ic" aria-hidden="true" />
            </span>
            <div class="cr-t-body">
              <span :class="{ struck: t.doneAt }">{{ t.text }}</span>
              <span class="cr-meta">
                <template v-if="t.doneAt">{{ T("crDone") }}</template>
                <template v-else-if="waiting(t)">{{ T("crNeedsOk") }}</template>
                <template v-else-if="t.physioOkAt">{{ T("crOkGiven") }}</template>
                <template v-if="t.targetMonth"> · {{ t.targetMonth }}</template>
                <template v-if="t.source === 'physio'"> · {{ T("crAddedByPhysio") }}</template>
              </span>
              <span v-if="canEdit" class="cr-actions">
                <button v-if="waiting(t)" class="primary small-btn" :disabled="busy" @click="setOk(g, t, true)"><ShieldCheck class="ic" aria-hidden="true" /> {{ T("crGiveOk") }}</button>
                <button v-else-if="t.needsPhysioOk && t.physioOkAt && !t.doneAt" class="ghost small-btn" :disabled="busy" @click="setOk(g, t, false)">{{ T("crWithdrawOk") }}</button>
                <button v-if="t.source === 'physio'" class="ghost danger small-btn" :disabled="busy" @click="removeStep(g, t)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
              </span>
            </div>
          </li>
        </ul>
        <form v-if="canEdit" class="cr-add" @submit.prevent="addStep(g)">
          <input v-model="stepText[g.id]" maxlength="160" :placeholder="T('stepPlaceholder')" :aria-label="T('addStep')" />
          <button class="ghost" :disabled="busy || !(stepText[g.id] ?? '').trim()"><Plus class="ic" aria-hidden="true" /> {{ T("addStep") }}</button>
        </form>
      </li>
    </ul>
    <form v-else-if="canEdit" class="card cr-item" @submit.prevent="addGoal">
      <p class="hint">{{ T("crNoGoals", { name: patient.name }) }}</p>
      <div class="cr-add">
        <input v-model="goalText" maxlength="160" :placeholder="T('goalText')" :aria-label="T('addGoal')" />
        <button class="primary" :disabled="busy || !goalText.trim()"><Plus class="ic" aria-hidden="true" /> {{ T("addGoal") }}</button>
      </div>
    </form>
    <div v-else class="card cr-empty"><Target class="ic" aria-hidden="true" /><p>{{ T("crNoGoals", { name: patient.name }) }}</p></div>
  </section>
</template>

<style scoped>
.cr-main { background: var(--dawn-soft); color: var(--dawn-ink); }
.cr-goal { font: 700 1.125rem/1.35 var(--display); overflow-wrap: anywhere; }
.cr-targets { gap: 6px; }
.cr-target { display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--canvas); }
.cr-target.waiting { background: var(--attention-soft); }
.cr-t-ic .ic { color: var(--ink-3); margin-top: 2px; }
.cr-t-ic .ic.done { color: var(--pine); }
.cr-target.waiting .cr-t-ic .ic { color: var(--attention-ink); }
.cr-t-body { display: grid; gap: 4px; min-width: 0; flex: 1; overflow-wrap: anywhere; }
.struck { text-decoration: line-through; color: var(--ink-3); }
.cr-add { display: flex; gap: 8px; flex-wrap: wrap; }
.cr-add input { flex: 1 1 180px; min-width: 0; }
</style>
