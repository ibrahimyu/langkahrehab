<script setup lang="ts">
import { Check, MessageSquareReply, Pencil, RotateCcw, Send, ShieldAlert, Trash2 } from "lucide-vue-next";
import { locale } from "#shared/i18n";
import type { Note, Patient } from "#shared/model";

// "My questions for the doctor" (PAS-05). Questions are notes of kind "question" (DAT-15), so they
// reach the doctor's "Since last visit" and the brief with everything else the patient said.
const props = defineProps<{ patientId: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();
const toast = useToast();

const notes = ref<Note[] | null>(null);
const loadError = ref("");
async function load() {
  loadError.value = "";
  try {
    notes.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient.notes;
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(load);

// Deleting waits for the toast, so Undo brings back the very same question (with any answer).
const pendingDelete = ref<string | null>(null);
const isAnswered = (n: Note) => !!(n.answeredAt || n.reply);
const questions = computed(() => (notes.value ?? []).filter((n) => n.kind === "question" && n.id !== pendingDelete.value).sort((a, b) => b.at.localeCompare(a.at)));
const waiting = computed(() => questions.value.filter((n) => !isAnswered(n)));
const answered = computed(() => questions.value.filter(isAnswered));

const draft = ref("");
const via = ref<"text" | "voice">("text");
const sending = ref(false);
async function add() {
  const quote = draft.value.trim();
  if (!quote) return;
  sending.value = true;
  try {
    notes.value = (await api<{ notes: Note[] }>(`/api/patients/${props.patientId}/notes`, { method: "POST", body: { kind: "question", quote, source: "typed", via: via.value } })).notes;
    draft.value = "";
    via.value = "text";
    toast.show(T("questionAdded"), { tone: "good" });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    sending.value = false;
  }
}

async function patch(n: Note, body: Record<string, unknown>) {
  notes.value = await api<Note[]>(`/api/patients/${props.patientId}/notes/${n.id}`, { method: "PATCH", body });
}

const editingId = ref<string | null>(null);
const editText = ref("");
function startEdit(n: Note) {
  editingId.value = n.id;
  editText.value = n.quote;
}
async function saveEdit(n: Note) {
  const before = n.quote;
  try {
    await patch(n, { quote: editText.value });
    editingId.value = null;
    toast.show(T("saved"), { tone: "good", undo: () => patch(n, { quote: before }).catch(() => {}) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}

async function setAnswered(n: Note, on: boolean) {
  try {
    await patch(n, { answered: on });
    toast.show(on ? T("qAnswered") : T("qWaiting"), { tone: "good", undo: () => patch(n, { answered: !on }).catch(() => {}) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}

let deleteTimer: ReturnType<typeof setTimeout> | undefined;
async function commitDelete() {
  const id = pendingDelete.value;
  if (!id) return;
  clearTimeout(deleteTimer);
  try {
    notes.value = await api<Note[]>(`/api/patients/${props.patientId}/notes/${id}`, { method: "DELETE" });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    pendingDelete.value = null;
  }
}
async function remove(n: Note) {
  await commitDelete(); // one pending delete at a time
  pendingDelete.value = n.id;
  toast.show(T("questionDeleted"), {
    tone: "good",
    undo: () => {
      clearTimeout(deleteTimer);
      pendingDelete.value = null;
    },
  });
  deleteTimer = setTimeout(commitDelete, 6000);
}
onBeforeUnmount(() => void commitDelete());

const when = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
const who = (n: Note) => (n.source === "family" ? T("roleFamily") : n.source === "typed" ? T("qByMe") : T("qByChat"));
</script>

<template>
  <section class="questions">
    <header class="page-q">
      <h1>{{ T("questionsTitle") }}</h1>
      <p class="hint">{{ T("questionsHelp") }}</p>
    </header>

    <form class="card stack" @submit.prevent="add">
      <textarea v-model="draft" rows="3" maxlength="300" :placeholder="T('questionPlaceholder')" :aria-label="T('addQuestion')" />
      <div class="controls">
        <UiMicButton @text="(v) => { draft = (draft + ' ' + v).trim(); via = 'voice'; }" />
        <button class="primary" :disabled="!draft.trim() || sending"><Send class="ic" aria-hidden="true" /> {{ T("addQuestion") }}</button>
      </div>
    </form>

    <div v-if="loadError" class="card stack">
      <p class="error">{{ loadError }}</p>
      <button class="ghost small-btn" @click="load">{{ T("tryAgain") }}</button>
    </div>
    <div v-else-if="!notes" class="skeleton-block" aria-hidden="true" />
    <p v-else-if="!questions.length" class="hint empty">{{ T("questionsEmpty") }}</p>

    <template v-else>
      <TransitionGroup v-if="waiting.length" tag="ul" name="q" class="q-list">
        <li v-for="n in waiting" :key="n.id" class="card q">
          <div class="q-top">
            <span class="pill">{{ T("qWaiting") }}</span>
            <span class="hint">{{ who(n) }} · {{ when(n.at) }}</span>
          </div>
          <form v-if="editingId === n.id" class="stack" @submit.prevent="saveEdit(n)">
            <textarea v-model="editText" rows="3" maxlength="300" :aria-label="T('edit')" />
            <div class="controls">
              <button class="primary small-btn" :disabled="!editText.trim()">{{ T("save") }}</button>
              <button type="button" class="ghost small-btn" @click="editingId = null">{{ T("cancel") }}</button>
            </div>
          </form>
          <p v-else class="q-text">{{ n.quote }}</p>
          <p v-if="n.urgency === 'now'" class="hint with-ic"><ShieldAlert class="ic" aria-hidden="true" /> {{ T("urgentStays") }}</p>
          <div v-if="editingId !== n.id" class="q-actions">
            <button class="ghost small-btn" @click="setAnswered(n, true)"><Check class="ic" aria-hidden="true" /> {{ T("markAnswered") }}</button>
            <template v-if="n.urgency !== 'now'">
              <button class="ghost small-btn" @click="startEdit(n)"><Pencil class="ic" aria-hidden="true" /> {{ T("edit") }}</button>
              <button class="ghost danger small-btn" @click="remove(n)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
            </template>
          </div>
        </li>
      </TransitionGroup>

      <template v-if="answered.length">
        <h2 class="list-head">{{ T("answeredSection") }}</h2>
        <TransitionGroup tag="ul" name="q" class="q-list">
          <li v-for="n in answered" :key="n.id" class="card q done">
            <div class="q-top">
              <span class="pill good"><Check class="ic" aria-hidden="true" /> {{ T("qAnswered") }}</span>
              <span class="hint">{{ who(n) }} · {{ when(n.at) }}</span>
            </div>
            <p class="q-text">{{ n.quote }}</p>
            <div v-if="n.reply" class="q-reply"><MessageSquareReply class="ic" aria-hidden="true" /><div><b>{{ T("replyFrom") }}</b><p>{{ n.reply }}</p></div></div>
            <div class="q-actions">
              <button v-if="n.answeredAt" class="ghost small-btn" @click="setAnswered(n, false)"><RotateCcw class="ic" aria-hidden="true" /> {{ T("markWaiting") }}</button>
              <button v-if="n.urgency !== 'now'" class="ghost danger small-btn" @click="remove(n)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
            </div>
          </li>
        </TransitionGroup>
      </template>
    </template>
  </section>
</template>

<style scoped>
.questions { display: grid; gap: 14px; }
.page-q { display: grid; gap: 6px; padding-top: 4px; }
.page-q h1 { font-size: clamp(1.5rem, 6vw, 1.875rem); }
.skeleton-block { height: 200px; border-radius: var(--r-card); background: var(--sunken); }
.empty { text-align: center; padding: 12px; }
.list-head { font-size: 1.0625rem; margin-top: 6px; }
.q-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.q { display: grid; gap: 8px; }
.q.done { background: var(--canvas); box-shadow: none; border: 1px solid var(--line); }
.q-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.q-text { font-size: 1.0625rem; overflow-wrap: anywhere; }
.pill.good { display: inline-flex; align-items: center; gap: 4px; background: var(--pine-soft); color: var(--pine); }
.pill .ic { width: 14px; height: 14px; }
.q-reply { display: flex; gap: 10px; padding: 12px; border-radius: 12px; background: var(--pine-soft); }
.q-reply .ic { color: var(--pine); flex: none; margin-top: 2px; }
.q-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.q-enter-active, .q-leave-active { transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
.q-enter-from, .q-leave-to { opacity: 0; transform: translateY(6px); }
@media (prefers-reduced-motion: reduce) { .q-enter-active, .q-leave-active { transition: none; } }
</style>
