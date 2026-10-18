<script setup lang="ts">
import { Bell, CalendarPlus, Check, ChevronRight, ExternalLink, MapPin, Plus, Save, Search, Sparkles, Trash2, UserPlus } from "lucide-vue-next";
import { buildIcs } from "#shared/calendar";
import { byTaskOrder, emptySourcing, loadsBody, needsItem, reminderRule, shareText, textOf } from "#shared/family";
import type { TextKey } from "#shared/i18n";
import { REMIND_EVERY, SOURCING_STATUS, type FamilyTask, type Sourcing, type TaskReminder } from "#shared/model";

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
const edit = reactive({ title: "", detail: "", assigneeId: null as string | null, dueDate: "" });
function openTask(t: FamilyTask) {
  openId.value = t.id;
  Object.assign(edit, { title: title(t), detail: textOf(t.detail, lang.value), assigneeId: t.assigneeId, dueDate: t.dueDate ?? "" });
  Object.assign(src, sourcingForm(t.sourcing));
  remind.value = t.reminder ? { ...t.reminder } : null;
}

// ---- Getting an item: the navigator finds options; the family notes where a borrowed one came from ----
const lastCity = () => v.value.tasks.map((t) => t.sourcing?.city).find(Boolean) ?? "";
const sourcingForm = (x: Sourcing | null | undefined) => {
  const s = x ?? emptySourcing(lastCity());
  return { status: s.status, from: s.from, contact: s.contact, returnBy: s.returnBy ?? "", city: s.city || lastCity() };
};
const src = reactive({ status: "looking" as Sourcing["status"], from: "", contact: "", returnBy: "", city: "" });
const finding = ref(false);
async function find() {
  const t = current.value;
  if (!t) return;
  finding.value = true;
  await send(`/tasks/${t.id}/find`, "POST", { city: src.city, lang: lang.value });
  finding.value = false;
}
async function saveSourcing() {
  const t = current.value;
  if (!t) return;
  const before = t.sourcing ?? null;
  const r = await send(`/tasks/${t.id}`, "PATCH", { sourcing: { ...src, returnBy: src.returnBy || null } }, { quiet: true });
  if (r === true) toast.show(T("saved"), { tone: "good", ms: 1800, undo: () => void send(`/tasks/${t.id}`, "PATCH", { sourcing: before ?? emptySourcing() }) });
  else toast.show(r, { tone: "bad" });
}

// ---- Reminder: in the app, and repeated by the phone's own calendar ----
const remind = ref<TaskReminder | null>(null);
async function saveReminder(next: TaskReminder | null) {
  const t = current.value;
  if (!t) return;
  const before = t.reminder ?? null;
  remind.value = next;
  const r = await send(`/tasks/${t.id}`, "PATCH", { reminder: next }, { quiet: true });
  if (r !== true) return toast.show(r, { tone: "bad" });
  if (next || before)
    toast.show(T("saved"), {
      tone: "good",
      ms: 1800,
      undo: () => {
        remind.value = before;
        void send(`/tasks/${t.id}`, "PATCH", { reminder: before });
      },
    });
}
function addToCalendar(t: FamilyTask) {
  if (!remind.value) return;
  const start = new Date().toISOString().slice(0, 10);
  const ics = buildIcs({ date: start, time: remind.value.time }, `${title(t)} (Langkah)`, T("remCalendarNote"), `${t.id}-reminder@langkah`, Date.now(), {
    rrule: reminderRule(remind.value, t.dueDate),
    alarm: "PT0M",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = "langkah-reminder.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function setTime(e: Event) {
  if (remind.value) void saveReminder({ every: remind.value.every, time: (e.target as HTMLInputElement).value });
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
  if (own.value) Object.assign(body, { title: edit.title, detail: edit.detail });
  saving.value = true;
  const r = await send(`/tasks/${t.id}`, "PATCH", body, { quiet: true });
  saving.value = false;
  if (r === true) {
    openId.value = null;
    toast.show(T("saved"), { tone: "good", ms: 1800 });
  } else editError.value = r === "body_task" ? T("famBodyTaskNo") : r;
}
function restoreBody(t: FamilyTask) {
  const base = { assigneeId: t.assigneeId, dueDate: t.dueDate, status: t.status, doneBy: t.doneBy, reminder: t.reminder ?? null, sourcing: t.sourcing ?? null };
  return t.templateId ? { ...base, templateId: t.templateId } : { ...base, title: String(t.title), detail: String(t.detail), category: t.category };
}
/** A suggested task removed by the person it was given to is not suggested to them again (Undo brings both back). */
async function remove(t: FamilyTask) {
  openId.value = null;
  const dismiss = !!t.templateId;
  if ((await send(`/tasks/${t.id}${dismiss ? "?dismiss=1" : ""}`, "DELETE")) === true)
    toast.show(dismiss ? T("famDismissed") : T("famTaskDeleted"), { tone: "good", undo: () => void send("/tasks", "POST", restoreBody(t)) });
}

// ---- Add a task ----
const adding = ref(false);
const draft = reactive({ title: "", detail: "", assigneeId: null as string | null, dueDate: "", item: false, templateId: null as string | null, reminder: null as TaskReminder | null });

// Ideas: approved suggestions this family does not have yet, and more from the AI on request.
type Idea = { title: string; detail: string; item: boolean; templateId: string | null };
const ideas = ref<Idea[]>([]);
const ideasBy = ref<"ai" | "template">("template");
const loadingIdeas = ref(false);
const api = useApi("family");
async function loadIdeas(ai = false) {
  loadingIdeas.value = true;
  try {
    const r = await api<{ ideas: Idea[]; by: "ai" | "template" }>(`/api/patients/${props.patientId}/family/tasks/ideas`, { method: "POST", body: { ai, lang: lang.value, memberId: me.value?.id } });
    ideas.value = r.ideas;
    ideasBy.value = r.by;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    loadingIdeas.value = false;
  }
}
const defaultTime = "08:00";
function useIdea(x: Idea) {
  Object.assign(draft, { title: x.title, detail: x.detail, item: x.item, templateId: x.templateId });
}
const addError = ref("");
function startAdd() {
  Object.assign(draft, { title: "", detail: "", assigneeId: me.value?.id ?? null, dueDate: "", item: false, templateId: null, reminder: null });
  addError.value = "";
  adding.value = true;
  void loadIdeas();
}
async function addTask() {
  addError.value = "";
  if (loadsBody(`${draft.title} ${draft.detail}`)) return (addError.value = T("famBodyTaskNo"));
  saving.value = true;
  const common = { assigneeId: draft.assigneeId, dueDate: draft.dueDate || null, reminder: draft.reminder };
  // An unchanged approved suggestion is added as itself (all three languages); anything else as written.
  const tpl = draft.templateId ? ideas.value.find((x) => x.templateId === draft.templateId) : undefined;
  const body = tpl && tpl.title === draft.title && tpl.detail === draft.detail
    ? { ...common, templateId: draft.templateId }
    : { ...common, title: draft.title, detail: draft.detail, category: draft.item ? "equipment" : "admin" };
  const r = await send("/tasks", "POST", body, { quiet: true });
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
            <TaskBadges :task="t" />
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
            <span class="task-meta"><TaskBadges :task="t" /></span>
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
        <p v-if="current.source === 'template' || current.source === 'rule'" class="task-meta"><span class="pill"><Sparkles class="ic" aria-hidden="true" /> {{ T("famSuggested") }}</span></p>

        <!-- Navigator: how to get the item, and where a borrowed one came from -->
        <section v-if="needsItem(current)" class="nav-box">
          <h3><MapPin class="ic" aria-hidden="true" /> {{ T("navTitle") }}</h3>
          <form class="nav-find" @submit.prevent="find">
            <label class="field"><span>{{ T("navCity") }}</span><input v-model="src.city" maxlength="60" autocomplete="address-level2" /></label>
            <button class="ghost" :disabled="finding"><Search class="ic" aria-hidden="true" /> {{ finding ? T("navFinding") : current.sourcing?.options.length ? T("navAgain") : T("navFind") }}</button>
          </form>
          <template v-if="current.sourcing?.options.length">
            <ul class="nav-options">
              <li v-for="(o, i) in current.sourcing.options" :key="i" class="nav-option">
                <span class="pill" :class="`kind-${o.kind}`">{{ T(`navKind_${o.kind}` as TextKey) }}</span>
                <b>{{ o.title }}</b>
                <span>{{ o.detail }}</span>
                <span v-if="o.cost" class="hint">{{ o.cost }}</span>
                <a v-if="o.url" :href="o.url" target="_blank" rel="noopener" class="link with-ic">{{ T("navOpen") }} <ExternalLink class="ic" aria-hidden="true" /></a>
              </li>
            </ul>
            <p class="hint">{{ current.sourcing.optionsBy === "ai" ? T("navByAi") : T("navByTemplate") }}</p>
          </template>
          <div class="field"><span>{{ T("navStatus") }}</span>
            <div class="chip-row">
              <button v-for="st in SOURCING_STATUS" :key="st" type="button" class="choice" :class="{ on: src.status === st }" :aria-pressed="src.status === st" @click="src.status = st">{{ T(`navStatus_${st}` as TextKey) }}</button>
            </div>
          </div>
          <template v-if="src.status !== 'looking'">
            <label class="field"><span>{{ T("navFrom") }}</span><input v-model="src.from" maxlength="80" /></label>
            <template v-if="src.status === 'borrowed'">
              <label class="field"><span>{{ T("navContact") }}</span><input v-model="src.contact" maxlength="60" inputmode="tel" /></label>
              <label class="field"><span>{{ T("navReturnBy") }}</span><input v-model="src.returnBy" type="date" /></label>
            </template>
          </template>
          <button class="ghost big-btn" @click="saveSourcing"><Save class="ic" aria-hidden="true" /> {{ T("save") }}</button>
        </section>

        <!-- Reminder -->
        <section v-if="current.status === 'open'" class="nav-box">
          <h3><Bell class="ic" aria-hidden="true" /> {{ T("remTitle") }}</h3>
          <div class="chip-row">
            <button type="button" class="choice" :class="{ on: !remind }" @click="saveReminder(null)">{{ T("remOff") }}</button>
            <button v-for="e in REMIND_EVERY" :key="e" type="button" class="choice" :class="{ on: remind?.every === e }" @click="saveReminder({ every: e, time: remind?.time ?? '08:00' })">{{ T(`remEvery_${e}` as TextKey) }}</button>
          </div>
          <template v-if="remind">
            <label class="field"><span>{{ T("remTime") }}</span><input :value="remind.time" type="time" @change="setTime" /></label>
            <button class="ghost big-btn" @click="addToCalendar(current)"><CalendarPlus class="ic" aria-hidden="true" /> {{ T("remCalendar") }}</button>
            <p class="hint">{{ T("remCalendarNote") }}</p>
          </template>
        </section>
        <form class="stack" @submit.prevent="saveTask">
          <template v-if="own">
            <label class="field"><span>{{ T("famTaskTitle") }}</span><input v-model="edit.title" maxlength="120" required /></label>
            <label class="field"><span>{{ T("famTaskDetail") }}</span><textarea v-model="edit.detail" rows="2" maxlength="400" /></label>
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
          <button class="ghost danger" @click="remove(current)"><Trash2 class="ic" aria-hidden="true" /> {{ current.templateId ? T("famDismiss") : T("delete") }}</button>
        </div>
        <p v-if="current.assigneeId && current.assigneeId !== me?.id" class="hint">{{ nameOf(current.assigneeId) }}</p>
      </template>
    </UiSheet>

    <!-- Add a task -->
    <UiSheet :open="adding" :title="T('famAddTask')" @close="adding = false">
      <form class="stack" @submit.prevent="addTask">
        <section class="ideas">
          <div class="ideas-head">
            <b><Sparkles class="ic" aria-hidden="true" /> {{ T("famIdeas") }}</b>
            <button type="button" class="ghost small-btn" :disabled="loadingIdeas" @click="loadIdeas(true)">{{ loadingIdeas ? T("navFinding") : T("famIdeasAi") }}</button>
          </div>
          <p v-if="!ideas.length && !loadingIdeas" class="hint">{{ T("famIdeasNone") }}</p>
          <div class="idea-list">
            <button v-for="(x, i) in ideas" :key="i" type="button" class="idea" :class="{ on: draft.title === x.title }" @click="useIdea(x)">
              <b>{{ x.title }}</b><span class="hint">{{ x.detail }}</span>
            </button>
          </div>
          <p v-if="ideasBy === 'ai'" class="hint">{{ T("famIdeasByAi") }}</p>
        </section>
        <label class="field"><span>{{ T("famTaskTitle") }}</span><input v-model="draft.title" maxlength="120" required /></label>
        <label class="field"><span>{{ T("famTaskDetail") }}</span><textarea v-model="draft.detail" rows="2" maxlength="400" /></label>
        <label class="item-toggle"><input v-model="draft.item" type="checkbox" /> {{ T("famNeedsItem") }}</label>
        <div class="field"><span>{{ T("famAssignTo") }}</span>
          <div class="chip-row">
            <button v-for="m in v.family" :key="m.id" type="button" class="choice" :class="{ on: draft.assigneeId === m.id }" :aria-pressed="draft.assigneeId === m.id" @click="draft.assigneeId = m.id">{{ m.id === me?.id ? T("famYou") : m.name }}</button>
          </div>
        </div>
        <label class="field"><span>{{ T("famDueDate") }}</span><input v-model="draft.dueDate" type="date" /></label>
        <div class="field"><span>{{ T("remTitle") }}</span>
          <div class="chip-row">
            <button type="button" class="choice" :class="{ on: !draft.reminder }" @click="draft.reminder = null">{{ T("remOff") }}</button>
            <button v-for="e in REMIND_EVERY" :key="e" type="button" class="choice" :class="{ on: draft.reminder?.every === e }" @click="draft.reminder = { every: e, time: draft.reminder?.time ?? defaultTime }">{{ T(`remEvery_${e}` as TextKey) }}</button>
          </div>
          <input v-if="draft.reminder" v-model="draft.reminder.time" type="time" :aria-label="T('remTime')" />
        </div>
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
.task-title { font-weight: 600; font-size: 1.0625rem; overflow-wrap: anywhere; }
.task.done .task-title { color: var(--ink-3); text-decoration: line-through; }
.task-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.item-toggle { display: flex; gap: 10px; align-items: center; min-height: 44px; font-weight: 600; }
.item-toggle input { width: 22px; height: 22px; accent-color: var(--pine); }
.ideas { display: grid; gap: 8px; padding: 12px; border-radius: var(--r-card); background: var(--pine-soft); }
.ideas-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ideas-head b { display: flex; gap: 6px; align-items: center; }
.idea-list { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 0 4px 2px; }
.idea { flex: none; width: 220px; display: grid; gap: 4px; align-content: start; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid transparent; background: var(--surface); color: var(--ink); cursor: pointer; }
.idea.on { border-color: var(--pine); }
.idea .hint { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.nav-box { display: grid; gap: 10px; padding: 14px; border-radius: var(--r-card); background: var(--sunken); }
.nav-box h3 { display: flex; gap: 8px; align-items: center; font-size: 1.0625rem; }
.nav-find { display: grid; gap: 8px; }
.nav-options { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.nav-option { display: grid; gap: 4px; justify-items: start; min-width: 0; overflow-wrap: anywhere; padding: 12px; border-radius: 12px; background: var(--surface); }
.kind-free { background: var(--good-soft); color: var(--good-ink); }
.kind-borrow { background: var(--info-soft); color: var(--info-ink); }
.kind-buy { background: var(--sunken); color: var(--ink-2); }
.chev { color: var(--ink-3); flex: none; }
.empty { text-align: center; color: var(--ink-2); }
.tasks-section { display: grid; gap: 10px; margin-top: 8px; }
.tasks-section h2 { font-size: 1.125rem; }
.other { display: grid; gap: 8px; }
.other-head { display: flex; align-items: center; justify-content: space-between; }
.other-list { margin: 0; padding-left: 18px; display: grid; gap: 4px; color: var(--ink-2); }
.other-list .link { text-align: left; }
.detail-text { font-size: 1.0625rem; line-height: 1.55; overflow-wrap: anywhere; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.choice { min-height: 44px; padding: 6px 16px; border-radius: var(--r-pill); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.choice:active { transform: scale(0.97); }
.choice.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
</style>
