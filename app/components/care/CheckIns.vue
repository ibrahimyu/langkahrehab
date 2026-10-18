<script setup lang="ts">
import { CalendarCheck, CalendarPlus, ClipboardCheck, FileText, MessageCircleQuestion, SlidersHorizontal, Stethoscope, Trash2 } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import type { CareRole, CheckIn, Note, Patient } from "#shared/model";

// Check-ins and the visit (DOK-05, FIS-10). A visit gets a date (default: the plan's review date),
// the visit screen lists the patient's and family's open questions to answer, and finishing it
// offers the next step for this role: the physio updates the plan, the doctor the limits.
const props = defineProps<{ patient: Patient; role: CareRole; compact?: boolean }>();
const emit = defineEmits<{ patch: [Partial<Patient>] }>();
const api = useApi(() => props.role);
const T = useT();
const lang = useLang();
const toast = useToast();
const base = computed(() => `/api/patients/${props.patient.id}`);

const list = computed(() => [...props.patient.checkIns].reverse().slice(0, props.compact ? 3 : 50));
const day = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(locale(lang.value), { weekday: "short", day: "numeric", month: "short" });
const roleName = (r: string) => T(r === "doctor" ? "roleDoctor" : r === "physio" ? "rolePhysio" : r === "family" ? "roleFamily" : "rolePatient");
const reviewDate = computed(() => props.patient.plan.reviewDate || "");

const busy = ref(false);
async function run<R>(work: () => Promise<R>): Promise<R | null> {
  busy.value = true;
  try {
    return await work();
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
    return null;
  } finally {
    busy.value = false;
  }
}
const patchCheckIn = (c: CheckIn, body: Record<string, unknown>) =>
  run(async () => {
    const checkIns = await api<CheckIn[]>(`${base.value}/checkins/${c.id}`, { method: "PATCH", body });
    emit("patch", { checkIns });
    return checkIns;
  });

// Date per open check-in, defaulting to the plan's review date.
const dates = reactive<Record<string, string>>({});
const dateOf = (c: CheckIn) => dates[c.id] ?? c.scheduledFor ?? reviewDate.value;
async function setDate(c: CheckIn) {
  const date = dateOf(c);
  if (!date) return;
  const before = { status: c.status, scheduledFor: c.scheduledFor };
  if (await patchCheckIn(c, { scheduledFor: date, status: "scheduled" })) toast.show(T("ciDateSaved", { date: day(date) }), { tone: "good", undo: () => void patchCheckIn(c, before) });
}

// Book a new visit.
const booking = ref(false);
const book = reactive<{ kind: CheckIn["kind"]; date: string; reason: string }>({ kind: "therapy", date: "", reason: "" });
function openBook() {
  Object.assign(book, { kind: props.role === "doctor" ? "doctor_review" : "therapy", date: reviewDate.value, reason: "" });
  booking.value = true;
}
async function saveBook() {
  const checkIns = await run(() => api<CheckIn[]>(`${base.value}/checkins`, { method: "POST", body: { kind: book.kind, scheduledFor: book.date, reason: book.reason.trim() } }));
  if (!checkIns) return;
  emit("patch", { checkIns });
  booking.value = false;
  toast.show(T("ciDateSaved", { date: day(book.date) }), { tone: "good" });
}

// Remove with Undo (the server puts the same check-in back).
async function remove(c: CheckIn) {
  const checkIns = await run(() => api<CheckIn[]>(`${base.value}/checkins/${c.id}`, { method: "DELETE" }));
  if (!checkIns) return;
  emit("patch", { checkIns });
  toast.show(T("ciRemoved"), {
    undo: async () => {
      const back = await run(() => api<CheckIn[]>(`${base.value}/checkins`, { method: "POST", body: { restore: c } }));
      if (back) emit("patch", { checkIns: back });
    },
  });
}

// The visit screen.
const visiting = ref<CheckIn | null>(null);
const finished = ref(false);
const visitNote = ref("");
const qIds = ref<string[]>([]);
const answers = reactive<Record<string, { answered: boolean; reply: string }>>({});
const questions = computed(() => qIds.value.map((id) => props.patient.notes.find((n) => n.id === id)).filter((n): n is Note => !!n));
function startVisit(c: CheckIn) {
  const open = props.patient.notes.filter((n) => n.kind === "question" && !n.private && !n.answeredAt);
  qIds.value = open.map((n) => n.id);
  for (const n of open) answers[n.id] = { answered: false, reply: n.reply ?? "" };
  visitNote.value = c.visitNote;
  finished.value = false;
  visiting.value = c;
}
async function finishVisit() {
  const c = visiting.value;
  if (!c) return;
  const ok = await run(async () => {
    let notes: Note[] | null = null;
    for (const n of questions.value) {
      const a = answers[n.id]!;
      if (!a.answered && a.reply.trim() === (n.reply ?? "")) continue;
      const r = await api<Pick<Note, "id" | "reply" | "answeredAt" | "readAt">>(`${base.value}/questions/${n.id}`, { method: "PATCH", body: { answered: a.answered, answer: a.reply.trim() } });
      notes = (notes ?? props.patient.notes).map((x) => (x.id === r.id ? { ...x, ...r } : x));
    }
    if (notes) emit("patch", { notes });
    const checkIns = await api<CheckIn[]>(`${base.value}/checkins/${c.id}`, { method: "PATCH", body: { status: "done", visitNote: visitNote.value.trim() } });
    emit("patch", { checkIns });
    return true;
  });
  if (!ok) return;
  finished.value = true;
  toast.show(T("ciFinished"), { tone: "good", undo: () => void patchCheckIn(c, { status: "scheduled" }) });
}
const nextLink = computed(() => recordLink(props.patient.id, props.role === "doctor" ? "profile" : "plan"));
</script>

<template>
  <section class="ci">
    <div class="cr-top">
      <h2 class="cr-h"><CalendarCheck class="ic" aria-hidden="true" /> {{ T("checkIns") }}</h2>
      <button class="ghost small-btn" :disabled="busy" @click="openBook"><CalendarPlus class="ic" aria-hidden="true" /> {{ T("ciBook") }}</button>
    </div>

    <button v-if="!patient.checkIns.length" class="ci-empty" @click="openBook">
      <CalendarPlus class="ic" aria-hidden="true" />
      <span>{{ T("ciEmpty") }}</span>
    </button>

    <ul v-else class="ci-list">
      <li v-for="c in list" :key="c.id" class="ci-item" :class="c.status">
        <div class="cr-top">
          <span class="ci-kind"><b>{{ T(`ciKind_${c.kind}` as TextKey) }}</b> <span class="pill" :class="`ci-${c.status}`">{{ T(`status_${c.status}` as TextKey) }}</span></span>
          <button class="ghost small-btn" :aria-label="T('remove')" :disabled="busy" @click="remove(c)"><Trash2 class="ic" aria-hidden="true" /></button>
        </div>
        <p class="cr-meta">{{ roleName(c.requestedBy) }} · {{ day(c.requestedAt) }}<template v-if="c.reason"> · “{{ c.reason }}”</template></p>

        <template v-if="c.status !== 'done'">
          <div class="ci-date">
            <label class="field">
              <span>{{ T("ciDate") }}</span>
              <input type="date" :value="dateOf(c)" @input="dates[c.id] = ($event.target as HTMLInputElement).value" />
            </label>
            <button v-if="dateOf(c) !== c.scheduledFor || c.status === 'requested'" class="ghost" :disabled="busy || !dateOf(c)" @click="setDate(c)">{{ T("ciSetDate") }}</button>
          </div>
          <button class="primary" :disabled="busy" @click="startVisit(c)"><Stethoscope class="ic" aria-hidden="true" /> {{ T("ciStart") }}</button>
        </template>
        <template v-else>
          <p v-if="c.scheduledFor" class="ci-when"><b>{{ day(c.scheduledFor) }}</b></p>
          <p v-if="c.visitNote" class="ci-note">{{ c.visitNote }}</p>
          <NuxtLink v-if="c.planVersion" :to="recordLink(patient.id, 'plan', `plan-v${c.planVersion}`)" class="link ci-plan"><FileText class="ic" aria-hidden="true" /> {{ T("ciPlanAt", { n: c.planVersion }) }}</NuxtLink>
        </template>
      </li>
    </ul>

    <UiSheet :open="booking" :title="T('ciBook')" @close="booking = false">
      <form class="stack" @submit.prevent="saveBook">
        <label class="field">
          <span>{{ T("ciDate") }}</span>
          <input v-model="book.date" type="date" required />
        </label>
        <div class="ci-kinds" role="radiogroup" :aria-label="T('ciBook')">
          <label v-for="k in ['doctor_review', 'therapy'] as const" :key="k" class="ci-option" :class="{ on: book.kind === k }">
            <input v-model="book.kind" type="radio" name="ci-kind" :value="k" /> {{ T(`ciKind_${k}` as TextKey) }}
          </label>
        </div>
        <label class="field">
          <span>{{ T("visitNote") }}</span>
          <input v-model="book.reason" maxlength="300" />
        </label>
        <button class="primary" :disabled="busy || !book.date">{{ T("ciBook") }}</button>
      </form>
    </UiSheet>

    <UiSheet :open="!!visiting" :title="visiting ? T('ciVisitTitle', { date: day(visiting.scheduledFor ?? visiting.requestedAt) }) : ''" @close="visiting = null">
      <div v-if="visiting && finished" class="stack ci-next">
        <span class="ci-done-ic"><ClipboardCheck class="ic" aria-hidden="true" /></span>
        <p><b>{{ T("ciFinished") }}</b></p>
        <p>{{ T("ciNext") }}</p>
        <NuxtLink :to="nextLink" class="primary" @click="visiting = null"><SlidersHorizontal class="ic" aria-hidden="true" /> {{ role === "doctor" ? T("ciUpdateLimits") : T("ciUpdatePlan") }}</NuxtLink>
        <button class="ghost" @click="visiting = null">{{ T("close") }}</button>
      </div>
      <form v-else-if="visiting" class="stack" @submit.prevent="finishVisit">
        <h3 class="cr-h"><MessageCircleQuestion class="ic" aria-hidden="true" /> {{ T("ciQuestions") }}</h3>
        <p v-if="!questions.length" class="cr-meta">{{ T("ciNoQuestions") }}</p>
        <div v-for="n in questions" :key="n.id" class="ci-q" :class="{ on: answers[n.id]!.answered }">
          <p class="ci-q-text">“{{ n.quote }}”</p>
          <p class="cr-meta">{{ n.source === "family" ? T("ciFromFamily") : T("ciFromPatient") }} · {{ day(n.at) }}</p>
          <label class="check inline ci-answered"><input v-model="answers[n.id]!.answered" type="checkbox" /> {{ T("ciAnswered") }}</label>
          <label class="field">
            <span>{{ T("ciAnswer") }}</span>
            <textarea v-model="answers[n.id]!.reply" rows="2" maxlength="600" />
          </label>
        </div>
        <label class="field">
          <span>{{ T("visitNote") }}</span>
          <textarea v-model="visitNote" rows="3" maxlength="2000" />
        </label>
        <button class="primary" :disabled="busy"><ClipboardCheck class="ic" aria-hidden="true" /> {{ T("ciFinish") }}</button>
      </form>
    </UiSheet>
  </section>
</template>

<style scoped>
.ci { display: grid; gap: 10px; min-width: 0; }
.ci-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.ci-item { display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: var(--canvas); min-width: 0; }
.ci-item .cr-meta, .ci-item p { margin: 0; overflow-wrap: anywhere; }
.ci-kind { display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ci-requested { background: var(--attention-soft); color: var(--attention-ink); }
.ci-scheduled { background: var(--info-soft); color: var(--info-ink); }
.ci-done { background: var(--good-soft); color: var(--good-ink); }
.ci-date { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.ci-date .field { flex: 1; min-width: 170px; }
.ci-date input { width: 100%; }
.ci-note { color: var(--ink-2); white-space: pre-line; }
.ci-plan { justify-self: start; display: inline-flex; gap: 6px; align-items: center; }
.ci-empty { display: flex; gap: 12px; align-items: center; text-align: left; padding: 16px; border: 1px dashed var(--line-strong); border-radius: 14px; background: var(--surface); color: var(--ink-2); font: inherit; cursor: pointer; transition: transform var(--dur-press) var(--ease-out); }
.ci-empty:active { transform: scale(0.99); }
.ci-empty .ic { flex: none; color: var(--pine); }
.ci-kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ci-option { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 12px; cursor: pointer; font-weight: 600; }
.ci-option input { width: 20px; height: 20px; min-height: 0; margin: 0; accent-color: var(--pine); }
.ci-option.on { border-color: var(--pine); background: var(--pine-soft); }
.ci-q { display: grid; gap: 6px; padding: 12px; border-radius: 12px; background: var(--sunken); transition: background-color var(--dur) var(--ease-out); }
.ci-q.on { background: var(--pine-soft); }
.ci-q p { margin: 0; }
.ci-q-text { font-weight: 600; overflow-wrap: anywhere; }
.ci-answered { font-size: 1rem; min-height: 44px; }
.ci-answered input { width: 22px; height: 22px; accent-color: var(--pine); }
.ci-q textarea, .stack .field textarea, .stack .field input { width: 100%; }
.ci-next { justify-items: start; }
.ci-next p { margin: 0; }
.ci-done-ic { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--pine); color: var(--surface); }
</style>
