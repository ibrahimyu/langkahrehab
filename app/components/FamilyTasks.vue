<script setup lang="ts">
import { Check, ChevronRight, Plus, Save, Trash2, UserPlus } from "lucide-vue-next";
import { byTaskOrder, loadsBody, shareText, textOf } from "#shared/family";
import type { TextKey } from "#shared/i18n";
import { TASK_COSTS, type FamilyTask, type TaskCost } from "#shared/model";

// Family tasks (KEL-03, kit Checklist): my jobs with big check boxes, jobs nobody has taken yet,
// and what the others are doing. Late tasks are never red. Tasks come from approved templates;
// the family may add their own, except anything about standing or walking.
const props = defineProps<{ patientId: string }>();
const T = useT();
const lang = useLang();
const toast = useToast();
const dayText = useDayText();
const { view, me, send, nameOf } = useFamily(props.patientId);
const v = computed(() => view.value!);
onMounted(() => send("/tasks", "POST", { generate: true }, { quiet: true }));

const mine = computed(() => v.value.tasks.filter((t) => t.assigneeId && t.assigneeId === me.value?.id).sort(byTaskOrder));
const mineOpen = computed(() => mine.value.filter((t) => t.status === "open"));
const unassigned = computed(() => v.value.tasks.filter((t) => !t.assigneeId && t.status === "open").sort(byTaskOrder));
const others = computed(() =>
  v.value.family
    .filter((m) => m.id !== me.value?.id)
    .map((m) => ({ m, open: v.value.tasks.filter((t) => t.assigneeId === m.id && t.status === "open").sort(byTaskOrder) }))
    .filter((x) => x.open.length),
);
const doneCount = computed(() => mine.value.length - mineOpen.value.length);
const title = (t: FamilyTask) => textOf(t.title, lang.value);
const langOf = (memberId: string | null) => v.value.family.find((m) => m.id === memberId)?.lang ?? lang.value;

async function toggle(t: FamilyTask) {
  const to = t.status === "done" ? "open" : "done";
  if ((await send(`/tasks/${t.id}`, "PATCH", { status: to, by: me.value?.id })) === true && to === "done")
    toast.show(T("famTaskDone"), { tone: "good", undo: () => void send(`/tasks/${t.id}`, "PATCH", { status: "open" }) });
}
const take = (t: FamilyTask) => send(`/tasks/${t.id}`, "PATCH", { assigneeId: me.value?.id });

// ---- Detail sheet: read, reassign, change the date, edit own words, share, delete ----
const openId = ref<string | null>(null);
const current = computed(() => v.value.tasks.find((t) => t.id === openId.value) ?? null);
const edit = reactive({ title: "", detail: "", assigneeId: null as string | null, dueDate: "", cost: "free" as TaskCost });
function openTask(t: FamilyTask) {
  openId.value = t.id;
  Object.assign(edit, { title: title(t), detail: textOf(t.detail, lang.value), assigneeId: t.assigneeId, dueDate: t.dueDate ?? "", cost: t.cost });
}
const own = computed(() => !!current.value && !current.value.templateId);
const editError = ref("");
const saving = ref(false);
async function saveTask() {
  const t = current.value;
  if (!t) return;
  editError.value = "";
  if (own.value && loadsBody(`${edit.title} ${edit.detail}`)) return (editError.value = T("famBodyTaskNo"));
  const body: Record<string, unknown> = { assigneeId: edit.assigneeId, dueDate: edit.dueDate || null };
  if (own.value) Object.assign(body, { title: edit.title, detail: edit.detail, cost: edit.cost });
  saving.value = true;
  const r = await send(`/tasks/${t.id}`, "PATCH", body, { quiet: true });
  saving.value = false;
  if (r === true) {
    openId.value = null;
    toast.show(T("saved"), { tone: "good", ms: 1800 });
  } else editError.value = r === "body_task" ? T("famBodyTaskNo") : r;
}
function restoreBody(t: FamilyTask) {
  const base = { assigneeId: t.assigneeId, dueDate: t.dueDate, status: t.status, doneBy: t.doneBy };
  return t.templateId ? { ...base, templateId: t.templateId } : { ...base, title: String(t.title), detail: String(t.detail), category: t.category, cost: t.cost };
}
async function remove(t: FamilyTask) {
  openId.value = null;
  if ((await send(`/tasks/${t.id}`, "DELETE")) === true) toast.show(T("famTaskDeleted"), { tone: "good", undo: () => void send("/tasks", "POST", restoreBody(t)) });
}

// ---- Add a task ----
const adding = ref(false);
const draft = reactive({ title: "", detail: "", assigneeId: null as string | null, dueDate: "", cost: "free" as TaskCost });
const addError = ref("");
function startAdd() {
  Object.assign(draft, { title: "", detail: "", assigneeId: me.value?.id ?? null, dueDate: "", cost: "free" });
  addError.value = "";
  adding.value = true;
}
async function addTask() {
  addError.value = "";
  if (loadsBody(`${draft.title} ${draft.detail}`)) return (addError.value = T("famBodyTaskNo"));
  saving.value = true;
  const r = await send("/tasks", "POST", { ...draft, dueDate: draft.dueDate || null, category: "admin" }, { quiet: true });
  saving.value = false;
  if (r === true) {
    adding.value = false;
    toast.show(T("famTaskAdded"), { tone: "good" });
  } else addError.value = r === "body_task" ? T("famBodyTaskNo") : r;
}
</script>

<template>
  <section class="fam-tasks">
    <header class="tasks-head">
      <h1>{{ T("famMyTasks") }}</h1>
      <span v-if="mine.length" class="hint tnum">{{ doneCount }}/{{ mine.length }}</span>
    </header>
    <div v-if="mine.length" class="meter-bar" aria-hidden="true"><span :style="{ width: `${(doneCount / mine.length) * 100}%` }" /></div>

    <ul v-if="mine.length" class="task-list">
      <li v-for="t in mine" :key="t.id" class="task" :class="{ done: t.status === 'done', next: t.id === mineOpen[0]?.id }">
        <button class="check" :class="{ on: t.status === 'done' }" role="checkbox" :aria-checked="t.status === 'done'" :aria-label="title(t)" @click="toggle(t)">
          <Check v-if="t.status === 'done'" class="ic" aria-hidden="true" />
        </button>
        <button class="task-body" @click="openTask(t)">
          <span class="task-title">{{ title(t) }}</span>
          <span class="task-meta">
            <span class="pill" :class="`cost-${t.cost}`">{{ T(`cost_${t.cost}` as TextKey) }}</span>
            <span v-if="t.dueDate && t.status === 'open'" class="hint">{{ T("famBy", { date: dayText(t.dueDate) }) }}</span>
          </span>
        </button>
        <ChevronRight class="ic chev" aria-hidden="true" />
      </li>
    </ul>
    <article v-else class="card empty">
      <p>{{ T("famAllDone") }}</p>
    </article>

    <div class="controls">
      <FamilyShare v-if="mineOpen.length" :text="shareText(mineOpen, me?.lang ?? lang, T('famMyTasks') + ':')" :label="T('famShareAll')" />
      <button class="ghost" @click="startAdd"><Plus class="ic" aria-hidden="true" /> {{ T("famAddTask") }}</button>
    </div>

    <section v-if="unassigned.length" class="tasks-section">
      <h2>{{ T("famUnassigned") }}</h2>
      <ul class="task-list">
        <li v-for="t in unassigned" :key="t.id" class="task">
          <button class="task-body" @click="openTask(t)">
            <span class="task-title">{{ title(t) }}</span>
            <span class="task-meta"><span class="pill" :class="`cost-${t.cost}`">{{ T(`cost_${t.cost}` as TextKey) }}</span></span>
          </button>
          <button class="ghost small-btn" @click="take(t)"><UserPlus class="ic" aria-hidden="true" /> {{ T("famTakeIt") }}</button>
        </li>
      </ul>
    </section>

    <section v-if="others.length" class="tasks-section">
      <h2>{{ T("famOthersHelping") }}</h2>
      <article v-for="o in others" :key="o.m.id" class="card other">
        <header class="other-head"><b>{{ o.m.name }}</b><span class="pill">{{ o.open.length }}</span></header>
        <ul class="other-list">
          <li v-for="t in o.open" :key="t.id"><button class="link" @click="openTask(t)">{{ title(t) }}</button></li>
        </ul>
      </article>
    </section>

    <!-- Task detail -->
    <UiSheet :open="!!current" :title="current ? title(current) : ''" @close="openId = null">
      <template v-if="current">
        <p v-if="current.detail && !own" class="detail-text">{{ textOf(current.detail, lang) }}</p>
        <p class="task-meta">
          <span class="pill" :class="`cost-${current.cost}`">{{ T(`cost_${current.cost}` as TextKey) }}</span>
          <span v-if="current.source === 'template'" class="hint">{{ T("famFromTemplate") }}</span>
        </p>
        <form class="stack" @submit.prevent="saveTask">
          <template v-if="own">
            <label class="field"><span>{{ T("famTaskTitle") }}</span><input v-model="edit.title" maxlength="120" required /></label>
            <label class="field"><span>{{ T("famTaskDetail") }}</span><textarea v-model="edit.detail" rows="2" maxlength="400" /></label>
            <div class="field"><span>{{ T("famCost") }}</span>
              <div class="seg seg-full" role="group" :aria-label="T('famCost')">
                <button v-for="c in TASK_COSTS" :key="c" type="button" :class="{ on: edit.cost === c }" @click="edit.cost = c">{{ T(`cost_${c}` as TextKey) }}</button>
              </div>
            </div>
          </template>
          <div class="field"><span>{{ T("famAssignTo") }}</span>
            <div class="chip-row">
              <button v-for="m in v.family" :key="m.id" type="button" class="choice" :class="{ on: edit.assigneeId === m.id }" :aria-pressed="edit.assigneeId === m.id" @click="edit.assigneeId = m.id">{{ m.id === me?.id ? T("famYou") : m.name }}</button>
            </div>
          </div>
          <label class="field"><span>{{ T("famDueDate") }}</span><input v-model="edit.dueDate" type="date" /></label>
          <p v-if="editError" class="error">{{ editError }}</p>
          <button class="primary big-btn" :disabled="saving || (own && !edit.title.trim())"><Save class="ic" aria-hidden="true" /> {{ T("save") }}</button>
        </form>
        <div class="controls">
          <FamilyShare :text="shareText([current], langOf(current.assigneeId))" />
          <button class="ghost danger" @click="remove(current)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
        </div>
        <p v-if="current.assigneeId && current.assigneeId !== me?.id" class="hint">{{ nameOf(current.assigneeId) }}</p>
      </template>
    </UiSheet>

    <!-- Add a task -->
    <UiSheet :open="adding" :title="T('famAddTask')" @close="adding = false">
      <form class="stack" @submit.prevent="addTask">
        <label class="field"><span>{{ T("famTaskTitle") }}</span><input v-model="draft.title" maxlength="120" required /></label>
        <label class="field"><span>{{ T("famTaskDetail") }}</span><textarea v-model="draft.detail" rows="2" maxlength="400" /></label>
        <div class="field"><span>{{ T("famCost") }}</span>
          <div class="seg seg-full" role="group" :aria-label="T('famCost')">
            <button v-for="c in TASK_COSTS" :key="c" type="button" :class="{ on: draft.cost === c }" @click="draft.cost = c">{{ T(`cost_${c}` as TextKey) }}</button>
          </div>
        </div>
        <div class="field"><span>{{ T("famAssignTo") }}</span>
          <div class="chip-row">
            <button v-for="m in v.family" :key="m.id" type="button" class="choice" :class="{ on: draft.assigneeId === m.id }" :aria-pressed="draft.assigneeId === m.id" @click="draft.assigneeId = m.id">{{ m.id === me?.id ? T("famYou") : m.name }}</button>
          </div>
        </div>
        <label class="field"><span>{{ T("famDueDate") }}</span><input v-model="draft.dueDate" type="date" /></label>
        <p v-if="addError" class="error">{{ addError }}</p>
        <button class="primary big-btn" :disabled="saving || !draft.title.trim()"><Plus class="ic" aria-hidden="true" /> {{ T("famAddTask") }}</button>
      </form>
    </UiSheet>
  </section>
</template>

<style scoped>
.fam-tasks { display: grid; gap: 14px; }
.tasks-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.tasks-head h1 { font-size: 1.625rem; }
.tnum { font-variant-numeric: tabular-nums; }
.meter-bar { height: 8px; border-radius: var(--r-pill); background: var(--sunken); overflow: hidden; }
.meter-bar span { display: block; height: 100%; border-radius: inherit; background: var(--dawn); transition: width var(--dur-slow) var(--ease-out); }
.task-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.task { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 8px 12px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); }
.task.next { border-color: var(--dawn); background: color-mix(in srgb, var(--dawn-soft) 55%, var(--surface)); }
.check { display: grid; place-items: center; width: 48px; height: 48px; flex: none; border-radius: 14px; border: 2px solid var(--line-strong); background: var(--surface); color: var(--surface); cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.check:active { transform: scale(0.92); }
.check.on { background: var(--pine); border-color: var(--pine); }
.check .ic { width: 26px; height: 26px; }
.task-body { display: grid; gap: 6px; flex: 1; min-width: 0; padding: 6px 0; background: none; border: 0; text-align: left; color: var(--ink); cursor: pointer; font: inherit; }
.task-title { font-weight: 600; font-size: 1.0625rem; }
.task.done .task-title { color: var(--ink-3); text-decoration: line-through; }
.task-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cost-free { background: var(--good-soft); color: var(--good-ink); }
.cost-borrow { background: var(--info-soft); color: var(--info-ink); }
.cost-buy { background: var(--sunken); color: var(--ink-2); }
.chev { color: var(--ink-3); flex: none; }
.empty { text-align: center; color: var(--ink-2); }
.tasks-section { display: grid; gap: 10px; margin-top: 8px; }
.tasks-section h2 { font-size: 1.125rem; }
.other { display: grid; gap: 8px; }
.other-head { display: flex; align-items: center; justify-content: space-between; }
.other-list { margin: 0; padding-left: 18px; display: grid; gap: 4px; color: var(--ink-2); }
.other-list .link { text-align: left; }
.detail-text { font-size: 1.0625rem; line-height: 1.55; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.choice { min-height: 44px; padding: 6px 16px; border-radius: var(--r-pill); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.choice:active { transform: scale(0.97); }
.choice.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
</style>
