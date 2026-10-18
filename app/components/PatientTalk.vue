<script setup lang="ts">
import { Archive, AudioLines, Bot, Check, ChevronRight, HeartHandshake, History, MessageSquarePlus, Mic, MicOff, MoonStar, Phone, PhoneCall, Send, ShieldAlert, Square, Trash2, X } from "lucide-vue-next";
import { detectRedFlags, SpeechWindow } from "#shared/redflags";
import { defaultSettings, parseSettings } from "#shared/settings";
import type { LiveGrant } from "../composables/useLiveCoach";
import { locale, type TextKey } from "#shared/i18n";
import type { Goal, Note, Patient, Preferences } from "#shared/model";
import { isLate, type Proposal, type ReplyIssue, type TalkMessage } from "#shared/companion";
import { recoveryCard, type RecoveryTopic } from "#shared/recovery";

// Talk with Langkah (PAS-19, AI-09): a listening companion. The safety net decides the crisis screen,
// not the model; changes the companion proposes wait for the patient's "Yes" and can be undone.
const props = defineProps<{ patientId: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();
const toast = useToast();

type Offer = { kind: Note["kind"]; quote: string; summary: string; state?: "ask" | "sent" | "no"; noteId?: string };
type Bubble = { role: "user" | "model"; text: string; safeKey?: ReplyIssue | null; offers?: Offer[]; proposals?: { p: Proposal; state: "ask" | "done" | "no" }[]; redFlag?: boolean; card?: RecoveryTopic | null };
type TalkResponse = { mode: "reply" | "crisis" | "red_flag"; reply: string; safeKey?: ReplyIssue | null; notes: Note[]; saved: Note[]; offers?: Offer[]; proposals: Proposal[]; card?: RecoveryTopic | null };

const patient = ref<Patient | null>(null);
const loadError = ref("");
async function load() {
  loadError.value = "";
  try {
    patient.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient;
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(load);

// ---- The talk ----
const bubbles = ref<Bubble[]>([]);
const draft = ref("");
const sending = ref(false);
const crisis = ref(false);
const clock = ref(Date.now());
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => (tick = setInterval(() => (clock.value = Date.now()), 15_000)));
onBeforeUnmount(() => clearInterval(tick));
const late = computed(() => isLate(clock.value));

// ---- Kept on the phone: the open chat survives leaving the tab; an ended chat is saved or deleted ----
const store = useTalkHistory<Bubble>(props.patientId);
const startedAt = ref(new Date().toISOString());
let talkId: string = crypto.randomUUID();
onMounted(() => {
  const open = store.loadOpen();
  if (!open) return;
  bubbles.value = open.bubbles;
  draft.value = open.draft;
  crisis.value = open.crisis;
  startedAt.value = open.startedAt;
  scrollDown();
});
watch([bubbles, draft, crisis], () => store.saveOpen({ startedAt: startedAt.value, bubbles: bubbles.value, draft: draft.value, crisis: crisis.value }), { deep: true });

function clearOpen() {
  bubbles.value = [];
  draft.value = "";
  crisis.value = false;
  startedAt.value = new Date().toISOString();
  talkId = crypto.randomUUID();
}
const snapshot = () => ({ id: talkId, startedAt: startedAt.value, endedAt: new Date().toISOString(), bubbles: structuredClone(toRaw(bubbles.value)) });
const ending = ref(false);
function endAndKeep() {
  ending.value = false;
  store.keep(snapshot());
  clearOpen();
  toast.show(T("talkSaved"), { tone: "good" });
}
function endAndDelete() {
  ending.value = false;
  const talk = snapshot();
  const was = { draft: draft.value, crisis: crisis.value };
  clearOpen();
  toast.show(T("talkDeleted"), {
    undo: () => {
      bubbles.value = talk.bubbles;
      startedAt.value = talk.startedAt;
      talkId = talk.id;
      draft.value = was.draft;
      crisis.value = was.crisis;
    },
  });
}

const showHistory = ref(false);
const viewing = ref<string | null>(null);
const viewed = computed(() => store.history.value.find((t) => t.id === viewing.value) ?? null);
const when = (iso: string) => new Date(iso).toLocaleString(locale(lang.value), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const preview = (t: { bubbles: Bubble[] }) => t.bubbles.find((b) => b.role === "user")?.text ?? "";
function continueTalk(id: string) {
  const talk = store.history.value.find((t) => t.id === id);
  if (!talk) return;
  if (bubbles.value.length) store.keep(snapshot());
  store.remove(id);
  bubbles.value = talk.bubbles;
  startedAt.value = talk.startedAt;
  talkId = talk.id;
  crisis.value = false;
  viewing.value = null;
  showHistory.value = false;
  scrollDown();
}
function deleteSaved(id: string) {
  const undo = store.remove(id);
  if (viewing.value === id) viewing.value = null;
  toast.show(T("talkDeleted"), { undo });
}

const list = ref<HTMLElement | null>(null);
const scrollDown = () => nextTick(() => list.value?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" }));

async function send(text = draft.value, via: "text" | "voice" = "text") {
  text = text.trim();
  if (!text || sending.value || crisis.value) return;
  const history: TalkMessage[] = bubbles.value.map((b) => ({ role: b.role, text: b.text || (b.safeKey ? T(`talkSafe_${b.safeKey}` as TextKey) : "") }));
  bubbles.value.push({ role: "user", text });
  draft.value = "";
  sending.value = true;
  scrollDown();
  try {
    const r = await api<TalkResponse>(`/api/patients/${props.patientId}/talk`, { method: "POST", body: { text, via, lang: lang.value, history } });
    if (patient.value) patient.value.notes = r.notes;
    if (r.mode === "crisis") crisis.value = true;
    else
      bubbles.value.push({
        role: "model",
        text: r.reply,
        safeKey: r.safeKey ?? null,
        redFlag: r.mode === "red_flag",
        offers: r.offers?.length ? r.offers.map((o) => ({ ...o, state: "ask" as const })) : undefined,
        proposals: r.proposals.map((p) => ({ p, state: "ask" as const })),
        card: r.card ?? null,
      });
  } catch (e) {
    bubbles.value.pop();
    draft.value = text;
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    sending.value = false;
    scrollDown();
  }
}

// ---- Talk by voice (Gemini Live): it answers aloud, and knows when you have finished speaking ----
// Every sentence the patient says is checked for danger signs first; a match ends the voice chat and
// goes through the same safety net as typed Talk (crisis screen, alert to the care team).
const voiceOn = ref(false);
const heard = new SpeechWindow(10_000);
let shown = 0;
const voice = useLiveCoach({
  fetchGrant: () => api<LiveGrant>(`/api/patients/${props.patientId}/talk-live`, { method: "POST", body: { lang: lang.value } }),
  onTool: (name, args) => {
    if (name !== "keep_note") return { ok: false, error: "Unknown tool." };
    // Quiet: the server decides whether it is a question for the doctor or a note for the clinicians only.
    api<{ notes: Note[] }>(`/api/patients/${props.patientId}/notes`, { method: "POST", body: { kind: args.kind, topic: args.topic, asked: args.asked === true, quote: args.quote, summary: args.summary, source: "companion", via: "voice", talk: true } })
      .then((r) => patient.value && (patient.value.notes = r.notes))
      .catch(() => {});
    return { ok: true };
  },
  onInput: (text) => {
    const window = heard.push(text, Date.now());
    if (!detectRedFlags(window, lang.value)) return;
    stopVoice();
    void send(window, "voice");
  },
});
// The spoken turns become bubbles, so a voice chat can be read back, kept or deleted like a typed one.
watch(
  () => voice.lines.value.length,
  (n) => {
    for (const line of voice.lines.value.slice(shown, n)) {
      if (line.role === "app" || !line.text.trim()) continue;
      bubbles.value.push({ role: line.role === "patient" ? "user" : "model", text: line.text.trim() });
    }
    shown = n;
    scrollDown();
  },
);
async function startVoice() {
  shown = 0;
  voiceOn.value = true;
  await voice.start(parseSettings({ ...defaultSettings, turn: { ...defaultSettings.turn, kind: "auto", silenceMs: 1200, endSensitivity: "low" } }));
}
function stopVoice() {
  voice.stop();
  voiceOn.value = false;
}
const voiceState = computed(() => (voice.state.value === "connecting" ? "connecting" : voice.userSpeaking.value ? "you" : voice.state.value === "speaking" ? "speaking" : "listening"));
watch(voice.state, (st) => {
  if (st === "error" || st === "ended") voiceOn.value = false;
});

// ---- A question the patient asked for the doctor: saved only when they say so (Undo takes it back) ----
async function sendOffer(o: Offer) {
  try {
    const r = await api<{ note: Note; notes: Note[] }>(`/api/patients/${props.patientId}/notes`, { method: "POST", body: { kind: o.kind, quote: o.quote, summary: o.summary, source: "companion", via: "text" } });
    if (patient.value) patient.value.notes = r.notes;
    o.state = "sent";
    o.noteId = r.note.id;
    toast.show(T("offerSent"), {
      tone: "good",
      undo: async () => {
        await api(`/api/patients/${props.patientId}/notes/${r.note.id}`, { method: "DELETE" });
        o.state = "ask";
      },
    });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}

// ---- Proposed changes: confirm, then undo from the toast ----
const proposalText = (p: Proposal) =>
  p.tool === "set_exercise_time" ? p.time : p.tool === "update_contact" ? [p.phone, p.email].filter(Boolean).join(" · ") : p.text;

async function putGoals(goals: Partial<Goal>[]) {
  patient.value!.goals = await api<Goal[]>(`/api/patients/${props.patientId}/goals`, { method: "PUT", body: { goals } });
}
async function putPrefs(body: Partial<Preferences>) {
  patient.value!.preferences = await api<Preferences>(`/api/patients/${props.patientId}/preferences`, { method: "PUT", body });
}
async function accept(item: { p: Proposal; state: string }) {
  const p = item.p;
  const before = structuredClone(toRaw(patient.value!));
  try {
    let undo: () => Promise<void>;
    let msg = T("proposeDone");
    if (p.tool === "set_goal" || p.tool === "add_target") {
      const goals = structuredClone(toRaw(patient.value!.goals));
      const main = goals.find((g) => g.main);
      if (p.tool === "set_goal" || !main) goals.push({ text: p.text, area: p.tool === "set_goal" ? p.area : "other", main: !goals.length, createdVia: "voice", targets: [] } as unknown as Goal);
      else main.targets.push({ text: p.text } as Goal["targets"][number]);
      await putGoals(goals);
      undo = () => putGoals(before.goals);
    } else if (p.tool === "set_exercise_time") {
      await putPrefs({ exerciseTime: p.time });
      undo = () => putPrefs({ exerciseTime: before.preferences.exerciseTime });
    } else if (p.tool === "update_contact") {
      await putPrefs({ ...(p.phone ? { phone: p.phone } : {}), ...(p.email ? { email: p.email } : {}) });
      undo = () => putPrefs({ phone: before.preferences.phone, email: before.preferences.email });
    } else {
      const r = await api<{ note: Note; notes: Note[] }>(`/api/patients/${props.patientId}/notes`, { method: "POST", body: { kind: "request", quote: p.text, source: "companion", via: "text", summary: `Asks the doctor to check the profile: ${p.text}` } });
      patient.value!.notes = r.notes;
      undo = async () => void (patient.value!.notes = await api<Note[]>(`/api/patients/${props.patientId}/notes/${r.note.id}`, { method: "DELETE" }));
      msg = T("proposeSentDoctor");
    }
    item.state = "done";
    toast.show(msg, { tone: "good", undo: () => undo().then(() => void (item.state = "ask")).catch((e) => toast.show(errorMessage(e), { tone: "bad" })) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}
</script>

<template>
  <section class="talk">
    <header class="talk-head">
      <span class="talk-avatar" aria-hidden="true"><HeartHandshake class="ic" /></span>
      <div class="talk-title">
        <h1>{{ T("talkTitle") }}</h1>
        <p class="hint">{{ T("talkLede") }}</p>
      </div>
    </header>
    <div class="talk-actions">
      <button class="ghost small-btn" @click="showHistory = true"><History class="ic" aria-hidden="true" /> {{ T("talkHistory") }}<template v-if="store.history.value.length"> · {{ store.history.value.length }}</template></button>
      <button v-if="bubbles.length || crisis" class="ghost small-btn" @click="ending = true"><MessageSquarePlus class="ic" aria-hidden="true" /> {{ T("talkEnd") }}</button>
    </div>

    <p v-if="loadError" class="error">{{ loadError }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>

    <!-- SYS-01 crisis screen: fixed text, not AI; it replaces the chat for the rest of this talk -->
    <section v-if="crisis" class="card crisis" role="alert">
      <h2>{{ T("crisisTitle") }}</h2>
      <p>{{ T("crisisBody") }}</p>
      <p>{{ T("talkCrisisStay") }}</p>
      <a class="primary big-btn" href="tel:119"><PhoneCall class="ic" aria-hidden="true" /> {{ T("talkCrisisLine") }}</a>
      <a class="ghost big-btn" :href="`tel:${(patient?.family.find((m) => m.phone)?.phone ?? '').replace(/[^\d+]/g, '')}`"><Phone class="ic" aria-hidden="true" /> {{ T("talkCallTrusted") }}<template v-if="patient?.family.find((m) => m.phone)"> · {{ patient.family.find((m) => m.phone)!.name }}</template></a>
      <p><b>{{ T("crisisEmergency") }}</b></p>
      <a class="danger-btn big-btn" href="tel:112"><PhoneCall class="ic" aria-hidden="true" /> {{ T("callEmergency") }}</a>
    </section>

    <template v-else>
      <!-- First visit of this talk: who this is (never that it is recorded: PAS-19) -->
      <article v-if="!bubbles.length" class="card stack intro">
        <p class="with-ic"><Bot class="ic" aria-hidden="true" /> {{ T("talkIntroAi") }}</p>
        <div class="stack starters">
          <span class="hint">{{ T("talkStarters") }}</span>
          <button v-for="k in (['talkStarter1', 'talkStarter2', 'talkStarter3'] as TextKey[])" :key="k" class="starter" :disabled="sending || !patient" @click="send(T(k))">{{ T(k) }}</button>
        </div>
      </article>

      <p v-if="late" class="card late with-ic"><MoonStar class="ic" aria-hidden="true" /> {{ T("talkLate") }}</p>

      <ol ref="list" class="bubbles" aria-live="polite">
        <li v-for="(b, i) in bubbles" :key="i" class="bubble-row" :class="b.role">
          <div class="bubble" :class="{ flag: b.redFlag }">
            <p v-if="b.redFlag" class="with-ic"><ShieldAlert class="ic" aria-hidden="true" /> {{ T("talkRedFlag") }}</p>
            <p v-else>{{ b.text || (b.safeKey ? T(`talkSafe_${b.safeKey}` as TextKey) : "") }}</p>
          </div>
          <div v-for="(o, j) in b.offers ?? []" :key="`o${j}`" class="card propose">
            <p>{{ T(o.kind === "question" ? "offerQuestion" : "offerNote", { text: o.quote }) }}</p>
            <div v-if="o.state === 'ask'" class="controls">
              <button class="primary" @click="sendOffer(o)"><Send class="ic" aria-hidden="true" /> {{ T("offerYes") }}</button>
              <button class="ghost" @click="o.state = 'no'"><X class="ic" aria-hidden="true" /> {{ T("offerNo") }}</button>
            </div>
            <p v-else-if="o.state === 'sent'" class="good-text with-ic"><Check class="ic" aria-hidden="true" /> {{ T("offerSent") }}</p>
          </div>
          <div v-for="(item, j) in b.proposals ?? []" :key="j" class="card propose">
            <p>{{ T(`propose_${item.p.tool}` as TextKey, { text: proposalText(item.p) }) }}</p>
            <div v-if="item.state === 'ask'" class="controls">
              <button class="primary" @click="accept(item)"><Check class="ic" aria-hidden="true" /> {{ T("proposeYes") }}</button>
              <button class="ghost" @click="item.state = 'no'"><X class="ic" aria-hidden="true" /> {{ T("proposeNo") }}</button>
            </div>
            <p v-else-if="item.state === 'done'" class="good-text with-ic"><Check class="ic" aria-hidden="true" /> {{ T("proposeDone") }}</p>
          </div>
          <NuxtLink v-if="b.card && recoveryCard(b.card)" :to="`/patient/${patientId}/learn/${b.card}`" class="card learn-card">
            <span class="learn-ic"><component :is="recoveryIcons[b.card]" class="ic" aria-hidden="true" /></span>
            <span class="learn-text"><span class="hint">{{ T("learnTitle") }}</span><b>{{ recoveryCard(b.card)!.title[lang] }}</b></span>
            <ChevronRight class="ic learn-chev" aria-hidden="true" />
          </NuxtLink>
        </li>
        <li v-if="sending" class="bubble-row model"><div class="bubble typing">{{ T("talkThinking") }}</div></li>
      </ol>

      <!-- Voice: speak, and Langkah answers aloud -->
      <section v-if="voiceOn" class="voice-panel" aria-live="polite">
        <span class="voice-orb" :class="`st-${voiceState}`" aria-hidden="true"><AudioLines class="ic" /></span>
        <b class="voice-state">{{ T(`talkVoice_${voiceState}`) }}</b>
        <p v-if="voice.caption.value && voiceState === 'speaking'" class="voice-caption">{{ voice.caption.value }}</p>
        <div class="voice-actions">
          <button class="ghost big-btn" @click="voice.toggleMic()"><component :is="voice.micOn.value ? MicOff : Mic" class="ic" aria-hidden="true" /> {{ voice.micOn.value ? T("mute") : T("unmute") }}</button>
          <button class="primary big-btn" @click="stopVoice"><Square class="ic" aria-hidden="true" /> {{ T("talkVoiceEnd") }}</button>
        </div>
      </section>
      <template v-else>
        <p v-if="voice.error.value" class="error">{{ voice.error.value }}</p>
        <!-- One row: empty draft → the round button starts a voice chat; typed text → it sends. -->
        <form class="composer composer-row" @submit.prevent="send()">
          <textarea v-model="draft" rows="1" maxlength="600" :placeholder="T('talkPlaceholderType')" :aria-label="T('talkPlaceholderType')" @keydown.enter.exact.prevent="send()" />
          <button v-if="draft.trim()" class="round-btn" :disabled="sending || !patient" :aria-label="T('send')"><Send class="ic" aria-hidden="true" /></button>
          <button v-else type="button" class="round-btn" :disabled="!patient" :aria-label="T('talkVoiceStart')" :title="T('talkVoiceStart')" @click="startVoice"><AudioLines class="ic" aria-hidden="true" /></button>
        </form>
      </template>
    </template>

    <UiSheet :open="ending" :title="T('talkEndTitle')" @close="ending = false">
      <div class="stack">
        <p>{{ T("talkEndBody") }}</p>
        <button class="primary big-btn" @click="endAndKeep"><Archive class="ic" aria-hidden="true" /> {{ T("talkKeep") }}</button>
        <button class="ghost danger big-btn" @click="endAndDelete"><Trash2 class="ic" aria-hidden="true" /> {{ T("talkDelete") }}</button>
        <button class="link" @click="ending = false">{{ T("cancel") }}</button>
      </div>
    </UiSheet>

    <UiSheet :open="showHistory" :title="viewed ? when(viewed.startedAt) : T('talkHistory')" @close="showHistory = false; viewing = null">
      <div v-if="viewed" class="stack">
        <ol class="bubbles">
          <li v-for="(b, i) in viewed.bubbles" :key="i" class="bubble-row" :class="b.role">
            <div class="bubble"><p>{{ b.text || (b.safeKey ? T(`talkSafe_${b.safeKey}` as TextKey) : "") }}</p></div>
          </li>
        </ol>
        <button class="primary big-btn" @click="continueTalk(viewed.id)">{{ T("talkContinue") }}</button>
        <button class="ghost danger big-btn" @click="deleteSaved(viewed.id)"><Trash2 class="ic" aria-hidden="true" /> {{ T("talkDelete") }}</button>
        <button class="link" @click="viewing = null">{{ T("back") }}</button>
      </div>
      <div v-else class="stack">
        <p class="hint">{{ T("talkHistoryHint") }}</p>
        <p v-if="!store.history.value.length" class="card">{{ T("talkHistoryEmpty") }}</p>
        <ul v-else class="talk-history">
          <li v-for="t in store.history.value" :key="t.id">
            <button class="talk-past" @click="viewing = t.id">
              <span class="talk-past-main"><b>{{ when(t.startedAt) }}</b><span class="hint">{{ preview(t) }}</span></span>
              <ChevronRight class="ic" aria-hidden="true" />
            </button>
            <button class="ghost small-btn" :aria-label="T('talkDelete')" @click="deleteSaved(t.id)"><Trash2 class="ic" aria-hidden="true" /></button>
          </li>
        </ul>
      </div>
    </UiSheet>
  </section>
</template>

<style scoped src="~/assets/css/talk.css"></style>
<style scoped>
.voice-panel { display: grid; justify-items: center; gap: 12px; padding: 20px 16px; border-radius: var(--r-sheet); background: var(--night); color: var(--on-night); }
.voice-orb { display: grid; place-items: center; width: 96px; height: 96px; border-radius: 50%; background: var(--night-raised); color: var(--on-night); transition: transform var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out); }
.voice-orb .ic { width: 40px; height: 40px; }
.voice-orb.st-you { background: var(--dawn); color: var(--ink); transform: scale(1.08); }
.voice-orb.st-speaking { background: var(--pine); animation: voice-pulse 1.4s ease-in-out infinite; }
.voice-orb.st-connecting { opacity: 0.6; }
@keyframes voice-pulse { 50% { transform: scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .voice-orb.st-speaking { animation: none; } }
.voice-state { font-size: 1.0625rem; }
.voice-caption { margin: 0; max-width: 32ch; text-align: center; color: var(--on-night-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.voice-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
.voice-actions .big-btn { display: flex; gap: 6px; align-items: center; justify-content: center; }
</style>
