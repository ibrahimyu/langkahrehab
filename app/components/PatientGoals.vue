<script setup lang="ts">
import { Check, ChevronRight, Lock, Pencil, Plus, ShieldCheck, Sparkles, Target as TargetIcon, Trash2 } from "lucide-vue-next";
import { goalProgress, loadsBody, nextTarget } from "#shared/goals";
import { locale, type TextKey } from "#shared/i18n";
import { GOAL_AREAS, type Goal, type GoalArea, type Patient, type Target } from "#shared/model";

// PAS-14: the patient's goals and the steps toward them. Everything here is editable by the patient,
// by typing or speaking. Body-loading steps wait for the physio's OK before they can be ticked.
const props = defineProps<{ patientId: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();
const toast = useToast();

const goals = ref<Goal[]>([]);
const loaded = ref(false);
const loadError = ref("");
onMounted(async () => {
  try {
    goals.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient.goals;
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loaded.value = true;
  }
});

const ordered = computed(() => [...goals.value].sort((a, b) => Number(b.main) - Number(a.main)));
const main = computed(() => ordered.value.find((g) => g.main) ?? null);
const others = computed(() => ordered.value.filter((g) => !g.main));
const next = computed(() => nextTarget(goals.value));
const monthLabel = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString(locale(lang.value), { month: "long", year: "numeric" });

/** Optimistic save: show the change at once, put it back if the server says no. */
async function commit(list: Goal[], message?: string, undoable = false) {
  const before = structuredClone(toRaw(goals.value));
  goals.value = list;
  try {
    goals.value = await api<Goal[]>(`/api/patients/${props.patientId}/goals`, { method: "PUT", body: { goals: list } });
    if (message) toast.show(message, { tone: "good", undo: undoable ? () => commit(before) : undefined });
  } catch {
    goals.value = before;
    toast.show(T("couldNotSave"), { tone: "bad" });
  }
}
const clone = () => structuredClone(toRaw(goals.value));

// ---- Steps ----
function toggleStep(g: Goal, t: Target) {
  if (t.needsPhysioOk && !t.physioOkAt) return;
  const list = clone();
  const target = list.find((x) => x.id === g.id)!.targets.find((x) => x.id === t.id)!;
  target.doneAt = target.doneAt ? null : new Date().toISOString();
  commit(list, target.doneAt ? T("stepDone") : undefined);
}
const newStep = reactive<Record<string, string>>({});
function addStep(g: Goal) {
  const text = (newStep[g.id] ?? "").trim();
  if (!text) return;
  const list = clone();
  list.find((x) => x.id === g.id)!.targets.push({ id: "", text, needsPhysioOk: loadsBody(text), physioOkAt: null, doneAt: null, targetMonth: null, source: "patient" });
  newStep[g.id] = "";
  commit(list, T("saved"));
}

// ---- Step sheet ----
const stepEdit = ref<{ goalId: string; id: string; text: string; month: string } | null>(null);
const openStep = (g: Goal, t: Target) => (stepEdit.value = { goalId: g.id, id: t.id, text: t.text, month: t.targetMonth ?? "" });
function saveStep() {
  const e = stepEdit.value!;
  const list = clone();
  const t = list.find((x) => x.id === e.goalId)!.targets.find((x) => x.id === e.id)!;
  t.text = e.text.trim() || t.text;
  t.targetMonth = e.month || null;
  stepEdit.value = null;
  commit(list, T("saved"));
}
function deleteStep() {
  const e = stepEdit.value!;
  const list = clone();
  const g = list.find((x) => x.id === e.goalId)!;
  g.targets = g.targets.filter((x) => x.id !== e.id);
  stepEdit.value = null;
  commit(list, T("stepDeleted"), true);
}

// ---- Goal sheet ----
const goalEdit = ref<{ id: string | null; text: string; area: GoalArea; main: boolean } | null>(null);
const openNewGoal = (text = "", area: GoalArea = "mobility") => (goalEdit.value = { id: null, text, area, main: !goals.value.length });
const openGoal = (g: Goal) => (goalEdit.value = { id: g.id, text: g.text, area: g.area, main: g.main });
function saveGoal() {
  const e = goalEdit.value!;
  const text = e.text.trim();
  if (!text) return;
  let list = clone();
  if (e.main) list = list.map((g) => ({ ...g, main: false }));
  if (e.id) Object.assign(list.find((g) => g.id === e.id)!, { text, area: e.area, main: e.main || list.find((g) => g.id === e.id)!.main });
  else list.push({ id: "", text, area: e.area, main: e.main, createdAt: "", createdVia: "text", targets: [] });
  goalEdit.value = null;
  commit(list, T("saved"));
}
// Visible delete on every goal, undoable (no "Are you sure?").
const removeGoal = (g: Goal) => commit(clone().filter((x) => x.id !== g.id), T("goalDeleted"), true);
function deleteGoal() {
  const id = goalEdit.value!.id;
  goalEdit.value = null;
  commit(clone().filter((g) => g.id !== id), T("goalDeleted"), true);
}

const firstGoal = ref("");
const showIdeas = ref(false);
function saveFirst() {
  const text = firstGoal.value.trim();
  if (!text) return;
  firstGoal.value = "";
  commit([{ id: "", text, area: "mobility", main: true, createdAt: "", createdVia: "text", targets: [] }], T("saved"));
}

const examples: { key: TextKey; area: GoalArea }[] = [
  { key: "example_walk", area: "mobility" },
  { key: "example_work", area: "work" },
  { key: "example_family", area: "family" },
  { key: "example_faith", area: "faith" },
];
const stepState = (t: Target, isNext: boolean) => (t.doneAt ? "done" : isNext ? "next" : t.needsPhysioOk && !t.physioOkAt ? "locked" : "todo");
</script>

<template>
  <section class="goals">
    <header class="page-q">
      <h1>{{ T("goalsTitle") }}</h1>
      <p class="hint">{{ T("goalsLede") }}</p>
    </header>

    <p v-if="loadError" class="error">{{ loadError }}</p>
    <div v-else-if="!loaded" class="skeleton-block" aria-hidden="true" />

    <!-- Empty: an invitation with one-tap starts, never a dead end. -->
    <!-- Empty: one card you can fill in straight away. Ideas stay hidden until asked for. -->
    <form v-else-if="!goals.length" class="card first-goal" @submit.prevent="saveFirst">
      <span class="empty-ic"><TargetIcon class="ic" aria-hidden="true" /></span>
      <h2>{{ T("noGoalsTitle") }}</h2>
      <p class="hint">{{ T("noGoalsBody") }}</p>
      <textarea v-model="firstGoal" rows="2" maxlength="160" :placeholder="T('example_walk')" :aria-label="T('goalText')" />
      <div class="controls">
        <UiMicButton @text="(v) => (firstGoal = (firstGoal + ' ' + v).trim())" />
        <button class="primary" :disabled="!firstGoal.trim()"><Plus class="ic" aria-hidden="true" /> {{ T("saveMyGoal") }}</button>
      </div>
      <button v-if="!showIdeas" type="button" class="link idea-link" @click="showIdeas = true">{{ T("needIdea") }}</button>
      <ul v-else class="ideas">
        <li v-for="ex in examples" :key="ex.key"><button type="button" class="link" @click="firstGoal = T(ex.key)">{{ T(ex.key) }}</button></li>
      </ul>
    </form>

    <template v-else>
      <article v-for="g in [main, ...others].filter(Boolean) as Goal[]" :key="g.id" class="goal-card" :class="{ hero: g.main }">
        <header class="goal-head">
          <span class="goal-area">{{ g.main ? T("mainGoal") : T(`area_${g.area}` as TextKey) }}</span>
          <span class="goal-actions">
            <button class="icon-btn" :aria-label="T('editGoal')" @click="openGoal(g)"><Pencil class="ic" aria-hidden="true" /></button>
            <button class="icon-btn" :aria-label="T('deleteGoal')" @click="removeGoal(g)"><Trash2 class="ic" aria-hidden="true" /></button>
          </span>
        </header>
        <h2 class="goal-text">{{ g.text }}</h2>

        <div v-if="g.targets.length" class="goal-progress">
          <div class="ticks" :aria-label="T('stepsDone', goalProgress(g))">
            <span v-for="t in g.targets" :key="t.id" :class="{ on: t.doneAt }" />
          </div>
          <span class="tnum">{{ T("stepsDone", goalProgress(g)) }}</span>
        </div>

        <ol class="steps-list">
          <li v-for="t in g.targets" :key="t.id" :class="`state-${stepState(t, next?.target.id === t.id)}`">
            <button class="step-check" :disabled="t.needsPhysioOk && !t.physioOkAt" :aria-pressed="!!t.doneAt" :aria-label="t.text" @click="toggleStep(g, t)">
              <Check v-if="t.doneAt" class="ic" aria-hidden="true" />
              <Lock v-else-if="t.needsPhysioOk && !t.physioOkAt" class="ic" aria-hidden="true" />
            </button>
            <button class="step-body" @click="openStep(g, t)">
              <span v-if="next?.target.id === t.id" class="step-next">{{ T("nextStepLabel") }}</span>
              <span class="step-text">{{ t.text }}</span>
              <span class="step-meta">
                <span v-if="t.needsPhysioOk && !t.physioOkAt" class="meta-bit"><Lock class="ic" aria-hidden="true" />{{ T("waitingPhysio") }}</span>
                <span v-else-if="t.needsPhysioOk" class="meta-bit"><ShieldCheck class="ic" aria-hidden="true" />{{ T("physioOk") }}</span>
                <span v-if="t.targetMonth" class="meta-bit">{{ monthLabel(t.targetMonth) }}</span>
                <span v-if="t.source === 'physio'" class="meta-bit"><Sparkles class="ic" aria-hidden="true" />{{ T("addedByPhysio") }}</span>
              </span>
            </button>
            <ChevronRight class="ic step-go" aria-hidden="true" />
          </li>
        </ol>

        <form class="add-step" @submit.prevent="addStep(g)">
          <input v-model="newStep[g.id]" :placeholder="T('stepPlaceholder')" :aria-label="T('addStep')" maxlength="160" />
          <UiMicButton @text="(v) => (newStep[g.id] = ((newStep[g.id] ?? '') + ' ' + v).trim())" />
          <button class="primary" :disabled="!(newStep[g.id] ?? '').trim()"><Plus class="ic" aria-hidden="true" /> {{ T("addStep") }}</button>
        </form>
      </article>

      <p class="hint needs-ok"><ShieldCheck class="ic" aria-hidden="true" /> {{ T("needsOkHint") }}</p>
      <button class="ghost big-btn" @click="openNewGoal()"><Plus class="ic" aria-hidden="true" /> {{ T("addGoal") }}</button>
    </template>

    <!-- Goal editor -->
    <UiSheet :open="!!goalEdit" :title="goalEdit?.id ? T('editGoal') : T('addGoal')" @close="goalEdit = null">
      <form v-if="goalEdit" class="sheet-form" @submit.prevent="saveGoal">
        <label class="field"><span>{{ T("goalText") }}</span>
          <textarea v-model="goalEdit.text" rows="2" maxlength="160" required />
        </label>
        <UiMicButton @text="(v) => goalEdit && (goalEdit.text = (goalEdit.text + ' ' + v).trim())" />
        <label class="field"><span>{{ T("goalArea") }}</span>
          <select v-model="goalEdit.area">
            <option v-for="a in GOAL_AREAS" :key="a" :value="a">{{ T(`area_${a}` as TextKey) }}</option>
          </select>
        </label>
        <button type="button" class="toggle" :aria-pressed="goalEdit.main" @click="goalEdit.main = !goalEdit.main"><span class="switch" :class="{ on: goalEdit.main }" /> {{ T("makeMain") }}</button>
        <button class="primary big-btn" :disabled="!goalEdit.text.trim()">{{ T("save") }}</button>
        <button v-if="goalEdit.id" type="button" class="ghost danger big-btn" @click="deleteGoal"><Trash2 class="ic" aria-hidden="true" /> {{ T("deleteGoal") }}</button>
      </form>
    </UiSheet>

    <!-- Step editor -->
    <UiSheet :open="!!stepEdit" :title="T('editStep')" @close="stepEdit = null">
      <form v-if="stepEdit" class="sheet-form" @submit.prevent="saveStep">
        <label class="field"><span>{{ T("addStep") }}</span><textarea v-model="stepEdit.text" rows="2" maxlength="160" /></label>
        <UiMicButton @text="(v) => stepEdit && (stepEdit.text = (stepEdit.text + ' ' + v).trim())" />
        <label class="field"><span>{{ T("targetMonth") }}</span><input v-model="stepEdit.month" type="month" /></label>
        <p class="hint">{{ T("planNotPromise") }}</p>
        <button class="primary big-btn">{{ T("save") }}</button>
        <button type="button" class="ghost danger big-btn" @click="deleteStep"><Trash2 class="ic" aria-hidden="true" /> {{ T("deleteStep") }}</button>
      </form>
    </UiSheet>
  </section>
</template>

<style scoped>
.goals { display: grid; gap: 16px; }
.page-q { display: grid; gap: 6px; padding-top: 4px; }
.page-q h1 { font-size: clamp(1.5rem, 6vw, 1.875rem); }
.skeleton-block { height: 320px; border-radius: var(--r-card); background: var(--sunken); }

/* Goal card: the main goal is the one bold element on the screen (night surface, like the kit's ContinueLearning). */
.goal-card { display: grid; gap: 12px; padding: 18px; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-sm); }
.goal-card.hero { background: var(--night); color: var(--on-night); box-shadow: var(--shadow-lg); }
.goal-head { display: flex; align-items: center; justify-content: space-between; }
.goal-actions { display: inline-flex; gap: 6px; }
.goal-area { font-size: 0.8125rem; font-weight: 600; color: var(--ink-2); }
.hero .goal-area { color: var(--pine-light); }
.goal-text { font-size: clamp(1.25rem, 5vw, 1.5rem); line-height: 1.2; }
.hero .goal-text { color: var(--on-night); }
.icon-btn { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: var(--r-btn); background: var(--sunken); color: var(--ink-2); cursor: pointer; transition: transform var(--dur-press) var(--ease-out); }
.icon-btn:active { transform: scale(0.94); }
.hero .icon-btn { background: var(--night-raised); color: var(--on-night); }

/* Progress as instrument ticks: one tick = one real step (kit TickMeter). */
.goal-progress { display: flex; align-items: center; gap: 10px; font-size: 0.875rem; color: var(--ink-2); }
.hero .goal-progress { color: var(--on-night-2); }
.ticks { display: flex; gap: 4px; flex: 1; }
.ticks span { flex: 1; height: 8px; border-radius: var(--r-pill); background: var(--sunken); transition: background-color var(--dur-slow) var(--ease-out); }
.hero .ticks span { background: var(--night-line); }
.ticks span.on { background: var(--dawn); }

.steps-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.steps-list li { display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 6px 8px 6px 6px; border-radius: 14px; transition: background-color var(--dur) var(--ease-out); }
.steps-list li.state-next { background: var(--dawn-soft); }
.hero .steps-list li.state-next { background: var(--night-raised); }
.step-check { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--line-strong); background: var(--surface); color: var(--surface); cursor: pointer; transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.step-check:active { transform: scale(0.9); }
.step-check:disabled { opacity: 1; cursor: not-allowed; color: var(--ink-3); background: var(--sunken); border-style: dashed; }
.hero .step-check { background: transparent; border-color: var(--on-night-2); }
.hero .step-check:disabled { background: var(--night-raised); color: var(--on-night-2); border-color: var(--night-line); }
.state-done .step-check { background: var(--pine); border-color: var(--pine); color: var(--surface); }
.hero .state-done .step-check { background: var(--pine-light); border-color: var(--pine-light); color: var(--ink); }
.step-check .ic { width: 20px; height: 20px; }
.step-body { flex: 1; min-width: 0; display: grid; gap: 2px; padding: 4px 0; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; }
.step-next { font-size: 0.75rem; font-weight: 700; color: var(--dawn-ink); text-transform: uppercase; letter-spacing: 0.04em; }
.hero .step-next { color: var(--dawn); }
.step-text { font-weight: 600; }
.state-done .step-text { color: var(--ink-3); text-decoration: line-through; }
.hero .state-done .step-text { color: var(--on-night-2); }
.step-meta { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 0.8125rem; color: var(--ink-3); }
.hero .step-meta { color: var(--on-night-2); }
.step-meta { column-gap: 10px; }
.meta-bit { display: inline-flex; align-items: center; gap: 4px; }
.step-meta .ic { width: 14px; height: 14px; flex: none; }
.step-go { color: var(--ink-3); flex: none; }
.hero .step-go { color: var(--on-night-2); }

.add-step { display: flex; gap: 8px; flex-wrap: wrap; }
.add-step input { flex: 1 1 200px; }
.hero .add-step input { background: var(--night-raised); border-color: var(--night-line); color: var(--on-night); }
.hero .add-step input::placeholder { color: var(--on-night-2); }
.hero .add-step .ghost { background: var(--night-raised); color: var(--on-night); border-color: var(--night-line); box-shadow: none; }
.needs-ok { display: flex; gap: 8px; align-items: flex-start; }

.first-goal { display: grid; gap: 12px; padding: 20px; }
.idea-link { justify-self: start; font-size: 0.9375rem; }
.ideas { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.empty-ic { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--pine-soft); color: var(--pine); }
.empty-ic .ic { width: 26px; height: 26px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.sheet-form .chip-row { justify-content: flex-start; }
.choice { min-height: 44px; padding: 8px 14px; border-radius: var(--r-pill); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.choice:active { transform: scale(0.97); }
.choice.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
.sheet-form { display: grid; gap: 14px; }
fieldset.field { border: 0; padding: 0; margin: 0; display: grid; gap: 8px; }
fieldset.field legend { font-size: 0.875rem; color: var(--ink-2); margin-bottom: 8px; }
</style>
