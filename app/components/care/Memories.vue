<script setup lang="ts">
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import { MEMORY_KINDS, type CareRole, type Memory, type MemoryKind, type Patient } from "#shared/model";

// What the coach remembers about the patient (FIS-05). The care team corrects, removes (with Undo)
// and adds memories; an edit records who changed it.
const props = defineProps<{ patient: Patient; role: CareRole }>();
const emit = defineEmits<{ patch: [Partial<Patient>] }>();
const api = useApi(() => props.role);
const T = useT();
const lang = useLang();
const toast = useToast();
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
const list = computed(() => [...props.patient.memories].reverse());
const url = computed(() => `/api/patients/${props.patient.id}/memories`);

const busy = ref(false);
async function call(work: () => Promise<Memory[]>) {
  busy.value = true;
  try {
    emit("patch", { memories: await work() });
    return true;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
    return false;
  } finally {
    busy.value = false;
  }
}
const putAll = (memories: Memory[]) => call(() => api<Memory[]>(url.value, { method: "PUT", body: memories }));

// Add
const draft = reactive<{ kind: MemoryKind; text: string }>({ kind: "goal", text: "" });
async function add() {
  if (!draft.text.trim()) return;
  if (await call(() => api<Memory[]>(url.value, { method: "POST", body: { ...draft, source: "care_team" } }))) {
    draft.text = "";
    toast.show(T("saved"), { tone: "good" });
  }
}

// Edit inline
const editing = ref<string | null>(null);
const edit = reactive<{ kind: MemoryKind; text: string }>({ kind: "other", text: "" });
function start(m: Memory) {
  editing.value = m.id;
  Object.assign(edit, { kind: m.kind, text: m.text });
}
async function saveEdit(m: Memory) {
  const before = structuredClone(toRaw(props.patient.memories));
  const next = before.map((x) => (x.id === m.id ? { ...x, kind: edit.kind, text: edit.text } : x));
  if (await putAll(next)) {
    editing.value = null;
    toast.show(T("saved"), { tone: "good", undo: () => void putAll(before) });
  }
}
async function remove(m: Memory) {
  const before = structuredClone(toRaw(props.patient.memories));
  if (await putAll(before.filter((x) => x.id !== m.id))) toast.show(T("crMemoryDeleted"), { tone: "good", undo: () => void putAll(before) });
}
const by = (m: Memory) => T(`crSrcMem_${m.source}` as TextKey);
</script>

<template>
  <section class="cr-section">
    <h2>{{ T("remembers") }}</h2>
    <form class="card cr-item" @submit.prevent="add">
      <div class="cr-mem-form">
        <select v-model="draft.kind" class="auto" :aria-label="T('crKind')">
          <option v-for="k in MEMORY_KINDS" :key="k" :value="k">{{ T(`crMem_${k}` as TextKey) }}</option>
        </select>
        <input v-model="draft.text" maxlength="300" :placeholder="T('crMemoryPlaceholder')" :aria-label="T('crAddMemory')" />
        <button class="primary" :disabled="busy || !draft.text.trim()"><Plus class="ic" aria-hidden="true" /> {{ T("crAddMemory") }}</button>
      </div>
    </form>

    <TransitionGroup v-if="list.length" tag="ul" name="cr-move" class="cr-list">
      <li v-for="m in list" :key="m.id" class="card cr-item">
        <template v-if="editing !== m.id">
          <div class="cr-top">
            <span class="pill">{{ T(`crMem_${m.kind}` as TextKey) }}</span>
            <span class="cr-meta">{{ by(m) }} · {{ day(m.createdAt) }}<template v-if="m.editedAt && m.editedBy"> · {{ T("crEditedBy", { who: T(m.editedBy === "doctor" ? "roleDoctor" : "rolePhysio"), date: day(m.editedAt) }) }}</template></span>
          </div>
          <p class="cr-mem-text">{{ m.text }}</p>
          <div class="cr-actions">
            <button class="ghost small-btn" :disabled="busy" @click="start(m)"><Pencil class="ic" aria-hidden="true" /> {{ T("edit") }}</button>
            <button class="ghost danger small-btn" :disabled="busy" @click="remove(m)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
          </div>
        </template>
        <form v-else class="stack" @submit.prevent="saveEdit(m)">
          <select v-model="edit.kind" class="auto" :aria-label="T('crKind')">
            <option v-for="k in MEMORY_KINDS" :key="k" :value="k">{{ T(`crMem_${k}` as TextKey) }}</option>
          </select>
          <textarea v-model="edit.text" rows="2" maxlength="300" :aria-label="T('edit')" />
          <div class="cr-actions">
            <button class="primary" :disabled="busy || !edit.text.trim()">{{ T("save") }}</button>
            <button type="button" class="ghost" @click="editing = null">{{ T("cancel") }}</button>
          </div>
        </form>
      </li>
    </TransitionGroup>
    <p v-else class="hint">{{ T("crNoMemories") }}</p>
  </section>
</template>

<style scoped>
.cr-mem-form { display: flex; gap: 8px; flex-wrap: wrap; }
.cr-mem-form input { flex: 1 1 200px; min-width: 0; }
.cr-mem-text { overflow-wrap: anywhere; }
.cr-move-move, .cr-move-enter-active, .cr-move-leave-active { transition: transform var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out); }
.cr-move-enter-from, .cr-move-leave-to { opacity: 0; transform: translateY(6px); }
</style>
