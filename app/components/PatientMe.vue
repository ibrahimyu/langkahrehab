<script setup lang="ts">
import { BookOpen, ChevronRight, Clock, Eye, EyeOff, Lock, LogOut, Mail, MessageCircleQuestion, MessageSquareReply, Phone, Route, Send, ShieldAlert, Trash2, UserRound } from "lucide-vue-next";
import { locale, profileText, type TextKey } from "#shared/i18n";
import type { Note, NoteKind, Patient, Preferences } from "#shared/model";

// The patient's own page (PAS-17, PAS-18): profile (read-only, recorded by the doctor, with a way to
// ask for a correction), settings they own, and the notes their care team will read.
const props = defineProps<{ patientId: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();
const toast = useToast();
const textSize = useTextSize();
const { signOut } = useSession();

const patient = ref<Patient | null>(null);
const loadError = ref("");
const prefs = reactive<Preferences>({ exerciseTime: null, exerciseDays: [], phone: "", email: "" });
onMounted(async () => {
  try {
    patient.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient;
    Object.assign(prefs, structuredClone(toRaw(patient.value.preferences)));
  } catch (e) {
    loadError.value = errorMessage(e);
  }
});

// ---- Settings: saved as the person changes them (no separate Save button to forget) ----
let prefsTimer: ReturnType<typeof setTimeout> | undefined;
function savePrefs(delay = 600) {
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(async () => {
    try {
      Object.assign(prefs, await api<Preferences>(`/api/patients/${props.patientId}/preferences`, { method: "PUT", body: prefs }));
      toast.show(T("saved"), { tone: "good", ms: 1800 });
    } catch (e) {
      toast.show(errorMessage(e), { tone: "bad" });
    }
  }, delay);
}
const toggleDay = (d: number) => {
  prefs.exerciseDays = prefs.exerciseDays.includes(d) ? prefs.exerciseDays.filter((x) => x !== d) : [...prefs.exerciseDays, d];
  savePrefs(0);
};
const days = [1, 2, 3, 4, 5, 6, 0];

// ---- Notes for the care team ----
const notes = computed(() => [...(patient.value?.notes ?? [])].sort((a, b) => b.at.localeCompare(a.at)));
const kinds: NoteKind[] = ["complaint", "need", "worry", "request", "question"];
const draft = reactive<{ kind: NoteKind; quote: string }>({ kind: "complaint", quote: "" });
const sending = ref(false);
async function sendNote(kind = draft.kind, quote = draft.quote) {
  if (!quote.trim()) return;
  sending.value = true;
  try {
    const res = await api<{ notes: Note[] }>(`/api/patients/${props.patientId}/notes`, { method: "POST", body: { kind, quote, source: "typed", via: "text" } });
    patient.value!.notes = res.notes;
    draft.quote = "";
    toast.show(T("noteSent"), { tone: "good" });
    return true;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    sending.value = false;
  }
}
async function setHidden(n: Note, hidden: boolean) {
  try {
    patient.value!.notes = await api<Note[]>(`/api/patients/${props.patientId}/notes/${n.id}`, { method: "PATCH", body: { private: hidden } });
    toast.show(hidden ? T("noteHidden") : T("noteShown"), { tone: "good", undo: () => setHidden(n, !hidden) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}
async function remove(n: Note) {
  const keep = { kind: n.kind, quote: n.quote };
  try {
    patient.value!.notes = await api<Note[]>(`/api/patients/${props.patientId}/notes/${n.id}`, { method: "DELETE" });
    toast.show(T("noteDeleted"), { tone: "good", undo: () => void sendNote(keep.kind, keep.quote) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}

// ---- Ask the doctor to correct the profile (the patient never edits clinical data directly) ----
const correcting = ref(false);
const correction = ref("");
async function sendCorrection() {
  if (await sendNote("request", `${T("askCorrection")}: ${correction.value}`)) {
    correcting.value = false;
    correction.value = "";
    toast.show(T("correctionSent"), { tone: "good" });
  }
}
const when = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
const initials = computed(() => (patient.value?.name ?? "").split(" ").map((w) => w[0]).join("").slice(0, 2));
</script>

<template>
  <section class="me">
    <p v-if="loadError" class="error">{{ loadError }}</p>
    <template v-if="patient">
      <!-- Profile -->
      <article class="card me-profile">
        <span class="avatar-initials" aria-hidden="true">{{ initials }}</span>
        <div class="me-id">
          <h1>{{ patient.name }}</h1>
          <p class="hint">{{ patient.age }} · {{ profileText(lang, patient.profile) }}</p>
          <p class="lock-line"><Lock class="ic" aria-hidden="true" /> {{ T("profileByDoctor") }}</p>
        </div>
      </article>
      <button v-if="!correcting" class="link with-ic" @click="correcting = true"><ShieldAlert class="ic" aria-hidden="true" /> {{ T("askCorrection") }}</button>
      <form v-else class="card stack" @submit.prevent="sendCorrection">
        <label class="field"><span>{{ T("correctionPlaceholder") }}</span><textarea v-model="correction" rows="2" maxlength="300" /></label>
        <div class="controls">
          <UiMicButton @text="(v) => (correction = (correction + ' ' + v).trim())" />
          <button class="primary" :disabled="!correction.trim() || sending"><Send class="ic" aria-hidden="true" /> {{ T("send") }}</button>
          <button type="button" class="ghost" @click="correcting = false">{{ T("cancel") }}</button>
        </div>
      </form>

      <!-- Journey, questions and learning (PAS-03, PAS-05, PAS-16) -->
      <nav class="card me-links" :aria-label="T('journeyTitle')">
        <NuxtLink :to="`/patient/${patientId}/journey`" class="me-link"><Route class="ic" aria-hidden="true" /><b>{{ T("journeyTitle") }}</b><ChevronRight class="ic chev" aria-hidden="true" /></NuxtLink>
        <NuxtLink :to="`/patient/${patientId}/questions`" class="me-link"><MessageCircleQuestion class="ic" aria-hidden="true" /><b>{{ T("questionsTitle") }}</b><ChevronRight class="ic chev" aria-hidden="true" /></NuxtLink>
        <NuxtLink :to="`/patient/${patientId}/learn`" class="me-link"><BookOpen class="ic" aria-hidden="true" /><b>{{ T("learnTitle") }}</b><ChevronRight class="ic chev" aria-hidden="true" /></NuxtLink>
      </nav>

      <!-- Notes for the care team -->
      <section class="me-section">
        <header>
          <h2>{{ T("forCareTeam") }}</h2>
          <p class="hint">{{ T("forCareTeamLede") }}</p>
        </header>
        <form class="card stack note-form" @submit.prevent="sendNote()">
          <div class="chip-row" role="group" :aria-label="T('addNote')">
            <button v-for="k in kinds" :key="k" type="button" class="choice" :class="{ on: draft.kind === k }" :aria-pressed="draft.kind === k" @click="draft.kind = k">{{ T(`note_${k}` as TextKey) }}</button>
          </div>
          <textarea v-model="draft.quote" rows="3" maxlength="400" :placeholder="T('notePlaceholder')" :aria-label="T('addNote')" />
          <div class="controls">
            <UiMicButton @text="(v) => (draft.quote = (draft.quote + ' ' + v).trim())" />
            <button class="primary" :disabled="!draft.quote.trim() || sending"><Send class="ic" aria-hidden="true" /> {{ T("send") }}</button>
          </div>
        </form>

        <ul v-if="notes.length" class="note-list">
          <li v-for="n in notes" :key="n.id" class="card note" :class="{ muted: n.private }">
            <div class="note-top">
              <span class="pill" :class="n.urgency === 'now' ? 'alert-pill urgent' : n.urgency === 'watch' ? 'alert-pill medium' : ''">{{ T(`note_${n.kind}` as TextKey) }}</span>
              <span class="hint">{{ when(n.at) }} · {{ T(`via_${n.via}` as TextKey) }}</span>
            </div>
            <p class="note-quote">“{{ n.quote }}”</p>
            <p v-if="n.urgency === 'now'" class="hint with-ic"><ShieldAlert class="ic" aria-hidden="true" /> {{ T("urgentStays") }}</p>
            <p v-if="n.readAt && n.readBy" class="hint with-ic"><Eye class="ic" aria-hidden="true" /> {{ T("readByTeam", { role: T(n.readBy === "doctor" ? "roleDoctor" : "rolePhysio") }) }}</p>
            <div v-if="n.reply" class="note-reply"><MessageSquareReply class="ic" aria-hidden="true" /><div><b>{{ T("replyFrom") }}</b><p>{{ n.reply }}</p></div></div>
            <div v-if="n.urgency !== 'now'" class="note-actions">
              <button class="ghost small-btn" @click="setHidden(n, !n.private)"><component :is="n.private ? Eye : EyeOff" class="ic" aria-hidden="true" /> {{ n.private ? T("show") : T("hide") }}</button>
              <button class="ghost danger small-btn" @click="remove(n)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
              <span v-if="n.private" class="pill">{{ T("hiddenLabel") }}</span>
            </div>
          </li>
        </ul>
        <p v-else class="hint">{{ T("noNotes") }}</p>
      </section>

      <!-- Settings -->
      <section class="me-section">
        <h2>{{ T("mySettings") }}</h2>
        <div class="card stack">
          <label class="field"><span class="with-ic"><Clock class="ic" aria-hidden="true" /> {{ T("exerciseTime") }}</span>
            <input v-model="prefs.exerciseTime" type="time" @change="savePrefs(0)" />
          </label>
          <div class="field"><span>{{ T("exerciseDays") }}</span>
            <div class="day-row">
              <button v-for="d in days" :key="d" type="button" class="day" :class="{ on: prefs.exerciseDays.includes(d) }" :aria-pressed="prefs.exerciseDays.includes(d)" @click="toggleDay(d)">{{ T(`day_${d}` as TextKey) }}</button>
            </div>
          </div>
          <label class="field"><span class="with-ic"><Phone class="ic" aria-hidden="true" /> {{ T("phoneLabel") }}</span><input v-model="prefs.phone" type="tel" inputmode="tel" autocomplete="tel" @input="savePrefs()" /></label>
          <label class="field"><span class="with-ic"><Mail class="ic" aria-hidden="true" /> {{ T("emailLabel") }}</span><input v-model="prefs.email" type="email" autocomplete="email" @change="savePrefs(0)" /></label>
          <div class="field"><span>{{ T("textSize") }}</span>
            <div class="seg seg-full" role="group" :aria-label="T('textSize')">
              <button v-for="t in TEXT_SIZES" :key="t" :class="{ on: textSize === t }" @click="textSize = t">{{ T(`textSize_${t}` as TextKey) }}</button>
            </div>
          </div>
        </div>
        <button class="ghost big-btn" @click="signOut"><LogOut class="ic" aria-hidden="true" /> {{ T("switchAccount") }}</button>
      </section>
    </template>
  </section>
</template>

<style scoped>
.me { display: grid; gap: 16px; }
.me-profile { display: flex; gap: 14px; align-items: center; }
.avatar-initials { display: grid; place-items: center; flex: none; width: 64px; height: 64px; border-radius: 50%; background: var(--pine-soft); color: var(--pine); font: 700 1.375rem/1 var(--display); }
.me-id { display: grid; gap: 4px; min-width: 0; }
.me-id h1 { font-size: 1.5rem; }
.lock-line { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--ink-3); }
.lock-line .ic { width: 14px; height: 14px; }
.me-links { display: grid; padding: 4px 6px; }
.me-link { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 10px; color: inherit; text-decoration: none; border-radius: 12px; }
.me-link + .me-link { border-top: 1px solid var(--line); }
.me-link > .ic:first-child { flex: none; color: var(--pine); }
.me-link b { flex: 1; min-width: 0; }
.me-link:active { background: var(--sunken); }
.me-link .chev { flex: none; color: var(--ink-3); }
.me-section { display: grid; gap: 12px; margin-top: 8px; }
.me-section header { display: grid; gap: 4px; }
.me-section h2 { font-size: 1.25rem; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.choice { min-height: 40px; padding: 6px 14px; border-radius: var(--r-pill); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.choice:active { transform: scale(0.97); }
.choice.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
.note-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.note { display: grid; gap: 8px; }
.note.muted { opacity: 0.7; }
.note-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.note-quote { font-size: 1.0625rem; }
.note-reply { display: flex; gap: 10px; padding: 12px; border-radius: 12px; background: var(--pine-soft); }
.note-reply .ic { color: var(--pine); flex: none; margin-top: 2px; }
.note-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.day-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.day { min-height: 44px; border-radius: var(--r-btn); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink-2); font-weight: 700; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.day:active { transform: scale(0.95); }
.day.on { background: var(--pine); border-color: var(--pine); color: var(--surface); }
</style>
