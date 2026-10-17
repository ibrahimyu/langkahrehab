<script setup lang="ts">
import { MessageSquareReply, Pencil, Save, Send, Trash2 } from "lucide-vue-next";
import { locale } from "#shared/i18n";

// Questions for the doctor (KEL-05, like PAS-05): the family writes or says them; the list shows
// who asked, whether it is answered, and the answer. Own unanswered questions can be changed or deleted.
const props = defineProps<{ patientId: string }>();
const T = useT();
const lang = useLang();
const toast = useToast();
const { view, me, send, nameOf } = useFamily(props.patientId);
const v = computed(() => view.value!);

const list = computed(() => [...v.value.questions].sort((a, b) => b.at.localeCompare(a.at)));
const who = (q: (typeof list.value)[number]) => (!q.fromFamily ? v.value.name : q.memberId === me.value?.id ? T("famYou") : nameOf(q.memberId) || T("roleFamily"));
const mineOpen = (q: (typeof list.value)[number]) => q.fromFamily && q.memberId === me.value?.id && !q.answered;
const when = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });

const text = ref("");
const via = ref<"text" | "voice">("text");
const sending = ref(false);
async function add(t = text.value) {
  if (!t.trim()) return;
  sending.value = true;
  const ok = (await send("/questions", "POST", { text: t, by: me.value?.id, via: via.value })) === true;
  sending.value = false;
  if (ok && t === text.value) {
    text.value = "";
    via.value = "text";
    toast.show(T("questionAdded"), { tone: "good" });
  }
  return ok;
}
async function remove(q: (typeof list.value)[number]) {
  if ((await send(`/questions/${q.id}`, "DELETE")) === true) toast.show(T("questionDeleted"), { tone: "good", undo: () => void send("/questions", "POST", { text: q.text, by: me.value?.id }) });
}
const editingId = ref<string | null>(null);
const editText = ref("");
async function saveEdit() {
  if ((await send(`/questions/${editingId.value}`, "PATCH", { text: editText.value })) === true) {
    editingId.value = null;
    toast.show(T("saved"), { tone: "good", ms: 1800 });
  }
}
</script>

<template>
  <section class="fam-q">
    <header class="q-head">
      <h1>{{ T("famQuestionsTitle") }}</h1>
      <p class="hint">{{ T("questionsHelp") }}</p>
    </header>

    <form class="card stack" @submit.prevent="add()">
      <textarea v-model="text" rows="3" maxlength="300" :placeholder="T('famQuestionPlaceholder')" :aria-label="T('addQuestion')" />
      <div class="controls">
        <UiMicButton @text="(s) => { text = (text + ' ' + s).trim(); via = 'voice'; }" />
        <button class="primary" :disabled="!text.trim() || sending"><Send class="ic" aria-hidden="true" /> {{ T("addQuestion") }}</button>
      </div>
    </form>

    <ul v-if="list.length" class="q-list">
      <li v-for="q in list" :key="q.id" class="card q">
        <div class="q-top">
          <span class="hint">{{ T("famAskedBy", { name: who(q) }) }} · {{ when(q.at) }}</span>
          <span class="pill" :class="q.answered ? 'answered' : ''">{{ q.answered ? T("famAnswered") : T("famWaiting") }}</span>
        </div>
        <form v-if="editingId === q.id" class="stack" @submit.prevent="saveEdit">
          <textarea v-model="editText" rows="2" maxlength="300" :aria-label="T('edit')" />
          <div class="controls">
            <button class="primary small-btn" :disabled="!editText.trim()"><Save class="ic" aria-hidden="true" /> {{ T("save") }}</button>
            <button type="button" class="ghost small-btn" @click="editingId = null">{{ T("cancel") }}</button>
          </div>
        </form>
        <p v-else class="q-text">{{ q.text }}</p>
        <div v-if="q.reply" class="q-reply"><MessageSquareReply class="ic" aria-hidden="true" /><div><b>{{ T("famDoctorAnswer") }}</b><p>{{ q.reply }}</p></div></div>
        <div v-if="mineOpen(q) && editingId !== q.id" class="controls">
          <button class="ghost small-btn" @click="editingId = q.id; editText = q.text"><Pencil class="ic" aria-hidden="true" /> {{ T("edit") }}</button>
          <button class="ghost danger small-btn" @click="remove(q)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
        </div>
      </li>
    </ul>
    <p v-else class="hint">{{ T("questionsEmpty") }}</p>
  </section>
</template>

<style scoped>
.fam-q { display: grid; gap: 14px; }
.q-head { display: grid; gap: 4px; }
.q-head h1 { font-size: 1.625rem; }
.q-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.q { display: grid; gap: 8px; }
.q-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.q-text { font-size: 1.0625rem; }
.pill.answered { background: var(--good-soft); color: var(--good-ink); }
.q-reply { display: flex; gap: 10px; padding: 12px; border-radius: 12px; background: var(--pine-soft); }
.q-reply .ic { color: var(--pine); flex: none; margin-top: 2px; }
</style>
