<script setup lang="ts">
import { Bot, Check, ChevronRight, HeartHandshake, MoonStar, Phone, PhoneCall, Send, ShieldAlert, X } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";
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

type Bubble = { role: "user" | "model"; text: string; safeKey?: ReplyIssue | null; shared?: Note[]; proposals?: { p: Proposal; state: "ask" | "done" | "no" }[]; redFlag?: boolean; card?: RecoveryTopic | null };
type TalkResponse = { mode: "reply" | "crisis" | "red_flag"; reply: string; safeKey?: ReplyIssue | null; notes: Note[]; saved: Note[]; proposals: Proposal[]; card?: RecoveryTopic | null };

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
        shared: r.saved,
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
      <div>
        <h1>{{ T("talkTitle") }}</h1>
        <p class="hint">{{ T("talkLede") }}</p>
      </div>
    </header>

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
      <!-- First visit of this talk: who this is, what is shared -->
      <article v-if="!bubbles.length" class="card stack intro">
        <p class="with-ic"><Bot class="ic" aria-hidden="true" /> {{ T("talkIntroAi") }}</p>
        <p class="with-ic"><ShieldAlert class="ic" aria-hidden="true" /> {{ T("talkIntroShare") }}</p>
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
          <p v-if="b.shared?.length" class="shared hint with-ic">
            <ShieldAlert class="ic" aria-hidden="true" /> {{ T("talkShared") }}: “{{ b.shared.map((n) => n.quote).join("”, “") }}”
            <NuxtLink :to="`/patient/${patientId}/me`" class="link">{{ T("talkSeeNotes") }}</NuxtLink>
          </p>
        </li>
        <li v-if="sending" class="bubble-row model"><div class="bubble typing">{{ T("talkThinking") }}</div></li>
      </ol>

      <form class="composer" @submit.prevent="send()">
        <textarea v-model="draft" rows="2" maxlength="600" :placeholder="T('talkPlaceholder')" :aria-label="T('talkPlaceholder')" @keydown.enter.exact.prevent="send()" />
        <div class="controls">
          <UiMicButton @text="(v) => send(v, 'voice')" />
          <button class="primary" :disabled="!draft.trim() || sending || !patient"><Send class="ic" aria-hidden="true" /> {{ T("send") }}</button>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.talk { display: grid; gap: 14px; }
.talk-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.talk-head > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.talk-head h1 { font-size: 1.5rem; }
.talk-avatar { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 50%; background: var(--dawn-soft); color: var(--dawn-ink); }
.intro p.with-ic { align-items: flex-start; }
.intro .ic { flex: none; margin-top: 3px; color: var(--pine); }
.starters { gap: 8px; }
.starter { text-align: left; min-height: 48px; padding: 10px 14px; border-radius: var(--r-btn-lg); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.starter:active { transform: scale(0.98); }
@media (hover: hover) { .starter:hover { background: var(--pine-soft); border-color: var(--pine); } }
.late { display: flex; gap: 10px; background: var(--dawn-soft); color: var(--ink); box-shadow: none; }
.late .ic { flex: none; color: var(--dawn-ink); margin-top: 2px; }

.bubbles { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.bubble-row { display: grid; gap: 8px; justify-items: start; }
.bubble-row.user { justify-items: end; }
.bubble { max-width: 86%; padding: 12px 16px; border-radius: 20px 20px 20px 6px; background: var(--surface); box-shadow: var(--shadow-sm); font-size: 1.0625rem; animation: rise var(--dur) var(--ease-out); }
.bubble-row.user .bubble { border-radius: 20px 20px 6px 20px; background: var(--pine); color: var(--surface); box-shadow: none; }
.bubble.flag { background: var(--dawn-soft); box-shadow: none; }
.bubble.flag .ic { flex: none; color: var(--dawn-ink); }
.bubble.typing { color: var(--ink-3); font-size: 0.9375rem; }
.learn-card { max-width: 86%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; color: inherit; text-decoration: none; transition: transform var(--dur-press) var(--ease-out); }
.learn-card:active { transform: scale(0.985); }
.learn-ic { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 12px; background: var(--pine-soft); color: var(--pine); }
.learn-text { display: grid; gap: 2px; flex: 1; min-width: 0; }
.learn-chev { flex: none; color: var(--ink-3); }
.propose { max-width: 86%; display: grid; gap: 10px; border: 1px solid var(--line-strong); box-shadow: none; }
.shared { max-width: 86%; flex-wrap: wrap; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .bubble { animation: none; } }

.composer { position: sticky; bottom: calc(84px + env(safe-area-inset-bottom)); display: grid; gap: 8px; padding: 12px; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-md); }
.composer textarea { resize: none; }

.crisis { display: grid; gap: 12px; background: var(--dawn-soft); box-shadow: none; }
.crisis h2 { font-size: 1.375rem; }
.big-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; }
.danger-btn { background: var(--danger-ink); color: var(--surface); border: 0; font-weight: 700; }
</style>
