<script setup lang="ts">
import type { Component } from "vue";
import { Archive, ArrowRight, Bot, ChevronRight, HeartHandshake, History, ListChecks, MessageCircleQuestion, MessageSquarePlus, PhoneCall, Send, ShieldAlert, ShieldCheck, Trash2, Users } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";

// The family's own companion: someone to talk to when the person they love is recovering and they
// do not know what to do. Each reply can point to one place in the app. Kept on this phone only.
const props = defineProps<{ patientId: string }>();
const api = useApi("family");
const T = useT();
const lang = useLang();
const toast = useToast();
const { view, me, send: familySend } = useFamily(props.patientId);

type Action = "none" | "tasks" | "questions" | "members" | "help";
type TaskIdea = { title: string; detail: string; item: boolean; added?: boolean };
type Bubble = { role: "user" | "model"; text: string; safeKey?: string | null; action?: Action; question?: string; questionSaved?: boolean; redFlag?: boolean; tasks?: TaskIdea[] };
type Reply = { mode: "reply" | "crisis" | "red_flag"; reply: string; safeKey?: string | null; action: Action; question: string; tasks?: TaskIdea[] };

const bubbles = ref<Bubble[]>([]);
const draft = ref("");
const sending = ref(false);
const crisis = ref(false);
const list = ref<HTMLElement | null>(null);
const scrollDown = () => nextTick(() => list.value?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" }));

const store = useTalkHistory<Bubble>(`${props.patientId}-family-${me.value?.id ?? "me"}`);
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

const bubbleText = (b: Bubble) => b.text || (b.safeKey ? T(`talkSafe_${b.safeKey}` as TextKey) : "");

async function send(text = draft.value) {
  text = text.trim();
  if (!text || sending.value || crisis.value) return;
  const history = bubbles.value.map((b) => ({ role: b.role, text: bubbleText(b) }));
  bubbles.value.push({ role: "user", text });
  draft.value = "";
  sending.value = true;
  scrollDown();
  try {
    const r = await api<Reply>(`/api/patients/${props.patientId}/family/talk`, { method: "POST", body: { text, lang: lang.value, memberId: me.value?.id, history } });
    if (r.mode === "crisis") crisis.value = true;
    else bubbles.value.push({ role: "model", text: r.reply, safeKey: r.safeKey ?? null, action: r.action, question: r.question || undefined, redFlag: r.mode === "red_flag", tasks: r.tasks?.length ? r.tasks : undefined });
  } catch (e) {
    bubbles.value.pop();
    draft.value = text;
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    sending.value = false;
    scrollDown();
  }
}

async function saveQuestion(b: Bubble) {
  if (!b.question) return;
  if ((await familySend("/questions", "POST", { text: b.question, by: me.value?.id, via: "text" })) === true) {
    b.questionSaved = true;
    toast.show(T("famTalkQuestionSaved"), { tone: "good" });
  }
}

async function addTask(x: TaskIdea) {
  const r = await familySend("/tasks", "POST", { title: x.title, detail: x.detail, assigneeId: me.value?.id, category: x.item ? "equipment" : "admin" });
  if (r === true) {
    x.added = true;
    toast.show(T("famTaskAdded"), { tone: "good" });
  }
}

const places: Record<Exclude<Action, "none">, { to: string; key: TextKey; icon: Component }> = {
  tasks: { to: "/tasks", key: "famTabTasks", icon: ListChecks },
  questions: { to: "/questions", key: "famTabQuestions", icon: MessageCircleQuestion },
  members: { to: "/members", key: "famTabFamily", icon: Users },
  help: { to: "/help", key: "famWhenToCall", icon: ShieldCheck },
};
const base = computed(() => `/family/${props.patientId}`);

// ---- End: keep in history or delete ----
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
  clearOpen();
  toast.show(T("talkDeleted"), {
    undo: () => {
      bubbles.value = talk.bubbles;
      startedAt.value = talk.startedAt;
      talkId = talk.id;
    },
  });
}
const showHistory = ref(false);
const viewing = ref<string | null>(null);
const viewed = computed(() => store.history.value.find((t) => t.id === viewing.value) ?? null);
const when = (iso: string) => new Date(iso).toLocaleString(locale(lang.value), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function deleteSaved(id: string) {
  const undo = store.remove(id);
  if (viewing.value === id) viewing.value = null;
  toast.show(T("talkDeleted"), { undo });
}
const STARTERS: TextKey[] = ["famTalkStarter1", "famTalkStarter2", "famTalkStarter3"];
</script>

<template>
  <section class="talk">
    <header class="talk-head">
      <span class="talk-avatar" aria-hidden="true"><HeartHandshake class="ic" /></span>
      <div>
        <h1>{{ T("famTalkTitle") }}</h1>
        <p class="hint">{{ T("famTalkLede", { name: view?.name ?? "" }) }}</p>
      </div>
    </header>
    <div class="talk-actions">
      <button class="ghost small-btn" @click="showHistory = true"><History class="ic" aria-hidden="true" /> {{ T("talkHistory") }}<template v-if="store.history.value.length"> · {{ store.history.value.length }}</template></button>
      <button v-if="bubbles.length || crisis" class="ghost small-btn" @click="ending = true"><MessageSquarePlus class="ic" aria-hidden="true" /> {{ T("talkEnd") }}</button>
    </div>

    <section v-if="crisis" class="card crisis" role="alert">
      <h2>{{ T("crisisTitle") }}</h2>
      <p>{{ T("famTalkCrisis") }}</p>
      <a class="primary big-btn" href="tel:119"><PhoneCall class="ic" aria-hidden="true" /> {{ T("talkCrisisLine") }}</a>
      <p><b>{{ T("crisisEmergency") }}</b></p>
      <a class="danger-btn big-btn" href="tel:112"><PhoneCall class="ic" aria-hidden="true" /> {{ T("callEmergency") }}</a>
    </section>

    <template v-else>
      <article v-if="!bubbles.length" class="card stack intro">
        <p class="with-ic"><Bot class="ic" aria-hidden="true" /> {{ T("famTalkIntro") }}</p>
        <p class="with-ic"><ShieldCheck class="ic" aria-hidden="true" /> {{ T("famTalkPrivate") }}</p>
        <div class="stack starters">
          <span class="hint">{{ T("talkStarters") }}</span>
          <button v-for="k in STARTERS" :key="k" class="starter" :disabled="sending" @click="send(T(k))">{{ T(k) }}</button>
        </div>
      </article>

      <ol ref="list" class="bubbles" aria-live="polite">
        <li v-for="(b, i) in bubbles" :key="i" class="bubble-row" :class="b.role">
          <div class="bubble" :class="{ flag: b.redFlag }">
            <p v-if="b.redFlag" class="with-ic"><ShieldAlert class="ic" aria-hidden="true" /> {{ T("famTalkRedFlag") }}</p>
            <p v-else>{{ bubbleText(b) }}</p>
          </div>
          <div v-if="b.question" class="card propose">
            <p>{{ T("famTalkSaveQuestion", { text: b.question }) }}</p>
            <button v-if="!b.questionSaved" class="primary" @click="saveQuestion(b)"><MessageCircleQuestion class="ic" aria-hidden="true" /> {{ T("famTalkSaveIt") }}</button>
            <p v-else class="good-text">{{ T("famTalkQuestionSaved") }}</p>
          </div>
          <div v-if="b.tasks?.length" class="card propose">
            <p class="hint">{{ T("famTalkTasks") }}</p>
            <div v-for="(x, j) in b.tasks" :key="j" class="task-idea">
              <span><b>{{ x.title }}</b><br v-if="x.detail" /><span v-if="x.detail" class="hint">{{ x.detail }}</span></span>
              <button v-if="!x.added" class="primary small-btn" @click="addTask(x)"><ListChecks class="ic" aria-hidden="true" /> {{ T("famTalkAddTask") }}</button>
              <NuxtLink v-else :to="`${base}/tasks`" class="link">{{ T("famTalkTaskAdded") }}</NuxtLink>
            </div>
          </div>
          <NuxtLink v-if="b.action && b.action !== 'none'" :to="base + places[b.action].to" class="card learn-card">
            <span class="learn-ic"><component :is="places[b.action].icon" class="ic" aria-hidden="true" /></span>
            <span class="learn-text"><b>{{ T(places[b.action].key) }}</b></span>
            <ArrowRight class="ic learn-chev" aria-hidden="true" />
          </NuxtLink>
        </li>
        <li v-if="sending" class="bubble-row model"><div class="bubble typing">{{ T("talkThinking") }}</div></li>
      </ol>

      <form class="composer" @submit.prevent="send()">
        <textarea v-model="draft" rows="2" maxlength="600" :placeholder="T('talkPlaceholder')" :aria-label="T('talkPlaceholder')" @keydown.enter.exact.prevent="send()" />
        <div class="controls">
          <UiMicButton @text="(v) => send(v)" />
          <button class="primary" :disabled="!draft.trim() || sending"><Send class="ic" aria-hidden="true" /> {{ T("send") }}</button>
        </div>
      </form>
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
          <li v-for="(b, i) in viewed.bubbles" :key="i" class="bubble-row" :class="b.role"><div class="bubble"><p>{{ bubbleText(b) }}</p></div></li>
        </ol>
        <button class="ghost danger big-btn" @click="deleteSaved(viewed.id)"><Trash2 class="ic" aria-hidden="true" /> {{ T("talkDelete") }}</button>
        <button class="link" @click="viewing = null">{{ T("back") }}</button>
      </div>
      <div v-else class="stack">
        <p class="hint">{{ T("talkHistoryHint") }}</p>
        <p v-if="!store.history.value.length" class="card">{{ T("talkHistoryEmpty") }}</p>
        <ul v-else class="talk-history">
          <li v-for="t in store.history.value" :key="t.id">
            <button class="talk-past" @click="viewing = t.id">
              <span class="talk-past-main"><b>{{ when(t.startedAt) }}</b><span class="hint">{{ t.bubbles.find((b) => b.role === "user")?.text }}</span></span>
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
.task-idea { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--line); }
.task-idea:first-of-type { border-top: 0; }
</style>
