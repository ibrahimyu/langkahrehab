<script setup lang="ts">
import { Check, CircleCheck, Eye, EyeOff, MessageSquareReply, Pencil, Send, ShieldAlert, Star, Trash2 } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import type { CareRole, Note, Patient } from "#shared/model";

// "Since last visit" (PAS-18): what the patient told the team, in their own words. The care team marks
// a note read, flags it for the visit and replies; the reply shows on the patient's Me page.
// Private notes never reach this screen (the server filters them).
const props = defineProps<{ patient: Patient; role: CareRole }>();
const emit = defineEmits<{ patch: [Partial<Patient>] }>();
const api = useApi(() => props.role);
const T = useT();
const lang = useLang();
const toast = useToast();

const filter = ref<"open" | "all">("open");
const urgencyRank = { now: 0, watch: 1, normal: 2 } as const;
const sorted = computed(() =>
  [...props.patient.notes].sort(
    (a, b) => Number(b.discussAtVisit) - Number(a.discussAtVisit) || Number(!!a.readAt) - Number(!!b.readAt) || urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.at.localeCompare(a.at),
  ),
);
const open = computed(() => sorted.value.filter((n) => !n.readAt || n.discussAtVisit));
const shown = computed(() => (filter.value === "open" ? open.value : sorted.value));

const busy = ref<string | null>(null);
async function send(n: Note, body: Record<string, unknown>) {
  busy.value = n.id;
  try {
    emit("patch", { notes: await api<Note[]>(`/api/patients/${props.patient.id}/notes/${n.id}`, { method: "PATCH", body }) });
    return true;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
    return false;
  } finally {
    busy.value = null;
  }
}
async function act(n: Note, body: Record<string, unknown>, done: TextKey, undo: Record<string, unknown>) {
  if (await send(n, body)) toast.show(T(done), { tone: "good", undo: () => void send(n, undo) });
}
const toggleRead = (n: Note) => (n.readAt ? act(n, { read: false }, "crMarkedUnread", { read: true }) : act(n, { read: true }, "crMarkedRead", { read: false }));
const toggleDiscuss = (n: Note) => act(n, { discussAtVisit: !n.discussAtVisit, read: true }, n.discussAtVisit ? "crDiscussOff" : "crDiscussOn", { discussAtVisit: n.discussAtVisit });

// Reply: one open editor at a time. Sending also marks the note read.
const replying = ref<string | null>(null);
const replyText = ref("");
function startReply(n: Note) {
  replying.value = n.id;
  replyText.value = n.reply;
}
async function sendReply(n: Note) {
  const before = n.reply;
  if (await send(n, { reply: replyText.value, read: true })) {
    replying.value = null;
    toast.show(T(before ? "crReplyEdited" : "crReplySent"), { tone: "good", undo: () => void send(n, { reply: before }) });
  }
}
const deleteReply = (n: Note) => act(n, { reply: "" }, "crReplyDeleted", { reply: n.reply });

const when = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
const roleName = (r: CareRole) => T(r === "doctor" ? "roleDoctor" : "rolePhysio");
</script>

<template>
  <section class="cr-section">
    <h2>{{ T("crSinceVisit") }}</h2>
    <div class="seg" role="tablist" :aria-label="T('crSinceVisit')">
      <button role="tab" :aria-selected="filter === 'open'" :class="{ on: filter === 'open' }" @click="filter = 'open'">{{ T("crToRead") }} · {{ open.length }}</button>
      <button role="tab" :aria-selected="filter === 'all'" :class="{ on: filter === 'all' }" @click="filter = 'all'">{{ T("crAll") }} · {{ sorted.length }}</button>
    </div>

    <TransitionGroup v-if="shown.length" tag="ul" name="cr-move" class="cr-list">
      <li v-for="n in shown" :key="n.id" class="card cr-item cr-note" :class="{ unread: !n.readAt, urgent: n.urgency === 'now' }">
        <div class="cr-top">
          <span class="cr-actions">
            <span v-if="n.urgency !== 'normal'" class="pill alert-pill" :class="n.urgency === 'now' ? 'urgent' : 'medium'"><ShieldAlert class="ic" aria-hidden="true" /> {{ T(n.urgency === "now" ? "crUrgent" : "crWatch") }}</span>
            <span class="pill">{{ T(`note_${n.kind}` as TextKey) }}</span>
            <span v-if="n.discussAtVisit" class="pill cr-visit"><Star class="ic" aria-hidden="true" /> {{ T("crAtVisit") }}</span>
          </span>
          <span class="cr-meta">{{ when(n.at) }} · {{ T(`crSrc_${n.source}` as TextKey) }} · {{ T(`via_${n.via}` as TextKey) }}</span>
        </div>
        <p class="cr-quote">“{{ n.quote }}”</p>
        <p v-if="n.summary && n.summary !== n.quote && !n.quote.startsWith(n.summary)" class="hint">{{ n.summary }}</p>

        <div v-if="n.reply && replying !== n.id" class="cr-reply">
          <MessageSquareReply class="ic" aria-hidden="true" />
          <div>
            <b>{{ T("crYourReply") }}</b>
            <p>{{ n.reply }}</p>
            <span class="cr-actions">
              <button class="link" @click="startReply(n)"><Pencil class="ic" aria-hidden="true" /> {{ T("edit") }}</button>
              <button class="link" @click="deleteReply(n)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
            </span>
          </div>
        </div>
        <form v-if="replying === n.id" class="stack" @submit.prevent="sendReply(n)">
          <textarea v-model="replyText" rows="3" maxlength="600" :aria-label="T('crReply')" :placeholder="T('crReplyPlaceholder')" />
          <div class="cr-actions">
            <button class="primary" :disabled="!replyText.trim() || busy === n.id"><Send class="ic" aria-hidden="true" /> {{ T("send") }}</button>
            <button type="button" class="ghost" @click="replying = null">{{ T("cancel") }}</button>
          </div>
        </form>

        <div class="cr-actions">
          <button class="ghost small-btn" :disabled="busy === n.id" @click="toggleRead(n)">
            <component :is="n.readAt ? EyeOff : Check" class="ic" aria-hidden="true" /> {{ T(n.readAt ? "crMarkUnread" : "crMarkRead") }}
          </button>
          <button class="ghost small-btn" :class="{ 'cr-on': n.discussAtVisit }" :aria-pressed="n.discussAtVisit" :disabled="busy === n.id" @click="toggleDiscuss(n)">
            <Star class="ic" aria-hidden="true" /> {{ T("crDiscuss") }}
          </button>
          <button v-if="!n.reply && replying !== n.id" class="ghost small-btn" @click="startReply(n)"><MessageSquareReply class="ic" aria-hidden="true" /> {{ T("crReply") }}</button>
        </div>
        <p v-if="n.readAt && n.readBy" class="cr-meta with-ic"><Eye class="ic" aria-hidden="true" /> {{ T("crReadBy", { who: roleName(n.readBy), date: when(n.readAt) }) }}</p>
      </li>
    </TransitionGroup>

    <div v-else class="card cr-empty">
      <CircleCheck class="ic" aria-hidden="true" />
      <p>{{ sorted.length ? T("crAllRead") : T("crNoNotes", { name: patient.name }) }}</p>
      <button v-if="sorted.length" class="ghost" @click="filter = 'all'">{{ T("crAll") }}</button>
    </div>
  </section>
</template>

<style scoped>
.cr-note { border-left: 4px solid transparent; }
.cr-note.unread { border-left-color: var(--dawn); }
.cr-note.urgent { border-left-color: var(--danger); }
.cr-quote { font-size: 1.0625rem; overflow-wrap: anywhere; }
.cr-visit { background: var(--dawn-soft); color: var(--dawn-ink); }
.cr-reply { display: flex; gap: 10px; padding: 12px; border-radius: 12px; background: var(--pine-soft); }
.cr-reply > .ic { color: var(--pine); flex: none; margin-top: 2px; }
.cr-reply p { overflow-wrap: anywhere; }
.cr-reply .link { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; }
.cr-move-move, .cr-move-enter-active, .cr-move-leave-active { transition: transform var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out); }
.cr-move-enter-from, .cr-move-leave-to { opacity: 0; transform: translateY(6px); }
.cr-move-leave-active { position: absolute; }
</style>
