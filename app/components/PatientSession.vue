<script setup lang="ts">
import { CircleAlert, Minus, Pause, Play, Plus, Settings2 } from "lucide-vue-next";
import { holdLines, repLine } from "#shared/cues";
import { exerciseById } from "#shared/exercises";
import { formBand, mainTip, average } from "#shared/form";
import type { TextKey } from "#shared/i18n";
import { limbOf, type CountMode, type Difficulty, type Patient } from "#shared/model";
import { tracking, type RepEvent } from "#shared/pose";
import { detectRedFlags, SpeechWindow } from "#shared/redflags";
import { applyTool, createSession, currentItem, currentLog, endRest, toRecordExercises, type Session } from "#shared/session";
import { VOICES, defaultSettings, parseSettings, type Settings } from "#shared/settings";
import type { LiveGrant } from "../composables/useLiveCoach";

// One exercise session over the whole plan. Two engines share the same session state:
// "coach" = Gemini Live voice coach moves the session with tool calls;
// "guide" = the app moves it from taps, with short spoken cues. The camera counts and scores in both.
const props = defineProps<{ patientId: string }>();
const emit = defineEmits<{ saved: [sessionId: string] }>();

const SETTINGS_KEY = "langkah-session-settings";
const IDLE_MS = 20_000;
const LONG_PAUSE_MS = 10 * 60_000;
const CUE_GAP_MS = 8000;

const api = useApi("patient");
const lang = useLang();
const T = useT();
const version = useDataVersion();
const pending = usePendingSession(props.patientId);
const voice = useReadAloud();

const patient = ref<Patient | null>(null);
const loadError = ref("");
const settings = reactive<Settings>(structuredClone(defaultSettings));
const session = ref<Session | null>(null);
const engine = ref<"coach" | "guide">("coach");
const showSettings = ref(false);

async function load() {
  loadError.value = "";
  try {
    patient.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient;
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(async () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) Object.assign(settings, parseSettings(JSON.parse(saved)));
    // UXA-09: on a low-end phone, start with the lighter pose model.
    else if ((navigator.hardwareConcurrency || 8) <= 4 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 3) settings.poseModel = "lite";
  } catch {}
  await load();
});

const planItems = computed(() =>
  (patient.value?.plan.items ?? []).map((i) => ({ exercise: exerciseById(i.exerciseId)!, sets: i.sets, reps: i.reps })).filter((i) => i.exercise),
);
function buildSession(mode: CountMode) {
  session.value = createSession(mode, planItems.value);
}

// ---- Live coach ----
let midSetIndex: { item: number; set: number } | null = null;
const coach = useLiveCoach({
  fetchGrant: (s) => api<LiveGrant>("/api/live-token", { method: "POST", body: { patientId: props.patientId, settings: s, lang: lang.value } }),
  onTool: (name, args) => {
    const s = session.value!;
    if (name === "save_memory" || name === "log_diary") {
      // BUG-03: a failed send is kept on the phone and goes out with the session, never dropped.
      const path = name === "save_memory" ? "memories" : "diary";
      const body = { ...args, source: "coach" };
      api(`/api/patients/${props.patientId}/${path}`, { method: "POST", body }).catch(() => pending.queueExtra(path, body));
      return { ok: true };
    }
    // A set starts only once the camera can see the limb it measures; the coach is told how to help.
    if (name === "start_set" && cameraBlind()) {
      startRefused = true;
      return { ok: false, error: `The camera cannot see the patient yet. Ask them, in a few words, to place the phone so their whole body is in view (${shownExercise.value?.id ? T(`camPlace_${shownExercise.value.id}` as TextKey) : ""}). Do not start the set and do not say the position is right. An [APP] message will say when the camera can see them.` };
    }
    // In camera mode the camera's count is the source of truth, whatever number the coach says.
    if (name === "log_set" && s.mode === "camera" && s.phase === "set") {
      const reps = currentLog(s).camera ?? 0;
      return { ...applyTool(s, name, { ...args, reps }, Date.now()), loggedReps: reps, countedBy: "camera" };
    }
    return applyTool(s, name, args, Date.now());
  },
  onInput: (text) => {
    const s = session.value;
    if (s?.phase === "set") currentLog(s).heardText += text;
    checkSafety(speech.push(text, Date.now()));
  },
  onTurnStart: () => {
    const s = session.value!;
    midSetIndex = s.phase === "set" && s.mode === "patient" ? { item: s.item, set: s.current } : null;
  },
  onTurnEnd: (tools) => {
    const s = session.value!;
    if (midSetIndex && !tools.includes("log_set")) s.items[midSetIndex.item]!.log[midSetIndex.set - 1]!.midSetTurns++;
    midSetIndex = null;
  },
});
const live = computed(() => engine.value === "coach" && ["connecting", "listening", "speaking"].includes(coach.state.value));
const coachDown = ref(false);
// The coach failing never ends the session: the app takes over from the same set.
watch(coach.state, (st) => {
  if (st !== "error" || engine.value !== "coach" || !session.value) return;
  coachDown.value = true;
  engine.value = "guide";
  guideSay();
});

// ---- Camera ----
type TrackerApi = { reset: () => void; start: () => Promise<void>; stop: () => void; lastMove: number; ready: boolean; framing: string | null };
const tracker = ref<TrackerApi | null>(null);
const item = computed(() => (session.value ? currentItem(session.value) : null));
const shownExercise = computed(() => item.value?.exercise ?? planItems.value[0]?.exercise);
const trackable = computed(() => {
  const e = shownExercise.value;
  const t = e && patient.value ? tracking(e.id, limbOf(patient.value.profile)) : null;
  return !!t && !t.unsupported;
});
const useCamera = computed(() => settings.mode === "camera");
const cueWords = { hold_longer: "hold a little longer at the top", slow_down: "move a little more slowly", go_further: "go a little further if it feels OK" } as const;
let lastCueAt = 0;
let targetSent = false;
let lastCorrection: number | null = null;
const lastRep = ref<RepEvent | null>(null);

function onRep(e: RepEvent) {
  const s = session.value!;
  if (s.phase !== "set" || paused.value) return;
  const log = currentLog(s);
  log.camera = e.count;
  if (e.form) log.form.push(e.form);
  lastRep.value = e;
  const target = currentItem(s).reps;
  const cueDue = e.cue && Date.now() - lastCueAt > CUE_GAP_MS;
  if (cueDue) lastCueAt = Date.now();
  const line = repLine(e, target, currentItem(s).exercise.id, lang.value, lastCorrection);
  if (line.corrected) lastCorrection = e.count;
  if (engine.value === "guide") {
    clearHold();
    voice.speak(line.text);
    if (e.count >= target && !targetSent) {
      targetSent = true;
      setTimeout(() => session.value?.phase === "set" && finishSet(), 1200);
    }
    return;
  }
  if (!live.value) return;
  if (e.count >= target && !targetSent) {
    targetSent = true;
    coach.say(`[APP] The camera counted ${e.count} reps, the target for this set. Call log_set now.`);
    return;
  }
  // The coach speaks after every rep, like a physio next to them: praise, or the one correction.
  const fix = line.corrected && e.cue ? ` Correction: tell them to ${cueWords[e.cue]}.` : line.corrected && e.form?.weakest === "range" ? ` Correction: tell them to ${cueWords.go_further}.` : " Good rep: short praise.";
  coach.say(`[APP] Camera: rep ${e.count} of ${target}, form ${e.form?.score ?? "–"}/100.${fix}`);
}

// ---- Spoken hold at the top (app guide): "Hold it. 1, 2, 3. And down slowly." ----
let holdTimers: ReturnType<typeof setTimeout>[] = [];
function clearHold() {
  holdTimers.forEach(clearTimeout);
  holdTimers = [];
}
function onTop() {
  const s = session.value;
  if (!s || s.phase !== "set" || paused.value || engine.value !== "guide") return;
  const lines = holdLines(currentItem(s).exercise.holdSeconds, lang.value);
  clearHold();
  lines.forEach((text, i) => holdTimers.push(setTimeout(() => (i === 0 ? voice.speak(text) : voice.queue(text)), i * 1000)));
}
onBeforeUnmount(clearHold);

// ---- Camera position: nothing starts until the camera can see the limb it measures ----
let startRefused = false;
const cameraBlind = () => useCamera.value && trackable.value && !tracker.value?.ready;
let lastFramingSaid = 0;
watch(
  () => tracker.value?.framing ?? null,
  (f) => {
    const s = session.value;
    if (!s || paused.value || (s.phase !== "set" && s.phase !== "ready")) return;
    if (!f) {
      // In view again: the coach may start the set it was asked to hold.
      if (startRefused && live.value && s.phase === "ready") coach.say("[APP] The camera can now see the patient. Tell them in a few words, then call start_set when they are ready.");
      startRefused = false;
      return;
    }
    if (Date.now() - lastFramingSaid < 12_000) return;
    lastFramingSaid = Date.now();
    if (engine.value === "guide") voice.speak(T("cueCantSee"));
    // Mid-set the coach says it at once; before a set it only needs to know (no extra turn).
    else if (live.value && s.phase === "set") coach.say("[APP] The camera cannot see the patient well. Ask them, in a few words, to move the phone back a little.");
    else if (live.value) coach.addContext("[APP] Camera: the patient is not fully in view yet.");
  },
);

watch(
  () => session.value?.phase,
  (p) => {
    coach.setSetActive(p === "set");
    if (p === "set") {
      tracker.value?.reset();
      lastCueAt = 0;
      lastCorrection = null;
      targetSent = false;
      idleWarned = false;
      lastRep.value = null;
    }
  },
);

// ---- Starting ----
const gate = ref<{ ask: () => Promise<void> } | null>(null);
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}
async function begin(withCoach: boolean) {
  saveSettings();
  const s = parseSettings(JSON.parse(JSON.stringify(settings)));
  Object.assign(settings, s);
  engine.value = withCoach ? "coach" : "guide";
  buildSession(s.mode === "coach" && !withCoach ? "patient" : s.mode);
  await nextTick();
  if (useCamera.value) void tracker.value?.start();
  if (withCoach) await coach.start(s);
}
const startWith = ref<"coach" | "guide">("coach");
function ask(withCoach: boolean) {
  startWith.value = withCoach ? "coach" : "guide";
  void gate.value?.ask();
}
const permissionCamera = computed(() => useCamera.value);

// ---- Guide engine: the app moves the session from taps ----
const manualReps = ref(0);
function guideSay() {
  const s = session.value;
  if (!s || engine.value !== "guide") return;
  const it = currentItem(s);
  if (s.phase === "ready") voice.speak(`${s.current === 1 ? T("sayNext", { name: it.exercise.name[lang.value] }) + " " : ""}${T("saySet", { n: s.current, tempo: it.exercise.tempo[lang.value] })}`);
}
function painBefore(n: number) {
  const s = session.value!;
  applyTool(s, "record_pain", { when: "before", score: n }, Date.now());
  guideSay();
}
function startSet() {
  const s = session.value!;
  applyTool(s, "start_set", { set: s.current }, Date.now());
  manualReps.value = currentItem(s).reps;
}
function finishSet() {
  const s = session.value!;
  if (s.phase !== "set") return;
  const reps = s.mode === "camera" && trackable.value ? currentLog(s).camera ?? 0 : manualReps.value;
  applyTool(s, "log_set", { set: s.current, reps }, Date.now());
  clearHold();
  if ((s.phase as Session["phase"]) === "rest") {
    feel.value = "ask";
    voice.speak(`${T("sayRest", { n: Math.round(((s.restUntil ?? Date.now()) - Date.now()) / 1000) })} ${T("cueHowFelt")}`);
  }
}

// ---- How did that set feel? (app guide) ----
const feel = ref<"ask" | "hurts" | null>(null);
function felt(answer: "fine" | "hard" | "hurts") {
  const s = session.value;
  if (answer === "fine") {
    feel.value = null;
    voice.speak(T("feltFineSay"));
  } else if (answer === "hard") {
    feel.value = null;
    if (s?.restUntil) s.restUntil += 15_000;
    voice.speak(T("feltHardSay"));
  } else {
    feel.value = "hurts";
    voice.speak(T("feltHurtsAsk"));
  }
}
function hurtsWorse(worse: boolean) {
  feel.value = null;
  if (worse) return feelWrong();
  const s = session.value;
  if (s?.restUntil) s.restUntil += 15_000;
  voice.speak(T("feltHardSay"));
}
function painAfter(n: number) {
  applyTool(session.value!, "record_pain", { when: "after", score: n }, Date.now());
}
function finish(d: Difficulty) {
  applyTool(session.value!, "finish_session", { difficulty: d }, Date.now());
  voice.speak(T("sayDone"));
}

// ---- Rest timer: the app, not the model, decides when rest is over ----
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => (tick = setInterval(onTick, 250)));
onBeforeUnmount(() => clearInterval(tick));
const restLeft = computed(() => {
  const until = session.value?.restUntil;
  return until ? Math.max(0, Math.ceil((until - now.value) / 1000)) : 0;
});
watch(restLeft, (left) => {
  const s = session.value;
  if (left > 0 || s?.phase !== "rest" || paused.value) return;
  const message = endRest(s);
  if (engine.value === "guide") guideSay();
  else if (message) coach.say(message);
});
const skipRest = () => session.value && (session.value.restUntil = Date.now());
const restTotal = computed(() => (session.value ? currentItem(session.value).exercise.restSeconds : 30));

// ---- Pause, and the 20-second "still with me?" check (PAS-02, PAS-09) ----
const paused = ref(false);
const idlePrompt = ref(false);
let pausedAt = 0;
let restLeftAtPause = 0;
let idleWarned = false;
function pause(idle = false) {
  const s = session.value;
  if (!s || paused.value) return;
  paused.value = true;
  idlePrompt.value = idle;
  pausedAt = Date.now();
  if (s.restUntil) restLeftAtPause = s.restUntil - Date.now();
  if (live.value && coach.micOn.value) coach.toggleMic();
  if (live.value) coach.addContext("[APP] The patient paused the session. Stay quiet until they resume.");
}
function resume() {
  const s = session.value;
  if (!s) return;
  paused.value = false;
  idlePrompt.value = false;
  if (s.phase === "rest" && s.restUntil) s.restUntil = Date.now() + restLeftAtPause;
  if (s.phase === "set") tracker.value?.reset();
  idleWarned = false;
  if (live.value) {
    if (!coach.micOn.value) coach.toggleMic();
    coach.say("[APP] The patient is back. Continue from where you left off, in one short sentence.");
  }
}
function onTick() {
  now.value = Date.now();
  const s = session.value;
  if (!s) return;
  if (paused.value && Date.now() - pausedAt > LONG_PAUSE_MS) return void endSession();
  if (s.phase !== "set" || paused.value || !useCamera.value || !trackable.value || idleWarned) return;
  const last = tracker.value?.lastMove ?? 0;
  if (!last || performance.now() - last < IDLE_MS) return;
  idleWarned = true;
  if (engine.value === "guide") pause(true);
  else if (live.value) coach.say("[APP] The camera has seen no movement for 20 seconds. Gently ask if they are OK and whether they want to continue or rest.");
}

// ---- Something feels wrong: the patient's own stop button ----
function feelWrong() {
  const s = session.value;
  if (!s || s.phase === "stopped" || s.phase === "done") return;
  applyTool(s, "report_concern", { kind: "other", details: "The patient pressed 'Something feels wrong'.", source: "patient" }, Date.now());
  if (live.value) coach.say("[APP] The patient pressed the stop button because something feels wrong. The session is stopped. Ask calmly what they feel, tell them to rest, and to contact their clinic if it does not settle.");
  else voice.speak(T("sayStop"));
}

// ---- Save when the session ends ----
const saving = ref(false);
const saveError = ref("");
let saved = false;
// One id per session: the server keeps the first copy, so a retry never makes a second session.
const clientId = crypto.randomUUID();
async function save(s: Session) {
  // A set cut short keeps the reps the camera counted.
  for (const it of s.items) for (const l of it.log) if (l.logged === null && l.camera !== null) l.logged = l.camera;
  const body = {
    clientId,
    lang: lang.value,
    mode: s.mode,
    exercises: toRecordExercises(s),
    painBefore: s.painBefore,
    painAfter: s.painAfter,
    difficulty: s.difficulty,
    concern: s.concern && { kind: s.concern.kind, details: s.concern.details, source: s.concern.source },
  };
  await sendPending({ path: "sessions", body });
}
/** Sends what is waiting (this session, and anything kept from before). Kept on the phone on failure. */
async function sendPending(sessionRequest?: { path: string; body: Record<string, unknown> }) {
  saving.value = true;
  saveError.value = "";
  try {
    const id = await pending.send(sessionRequest);
    version.value++;
    if (id) emit("saved", id);
  } catch (e) {
    saveError.value = errorMessage(e, T("notSavedYet"));
  } finally {
    saving.value = false;
  }
}
async function wrapUp(waitForCoach: boolean) {
  const s = session.value;
  if (!s || saved) return;
  saved = true;
  // Let the coach finish its last sentence.
  if (waitForCoach && live.value) await new Promise((r) => setTimeout(r, 4000));
  coach.stop();
  tracker.value?.stop();
  if (s.painBefore === null) return void navigateTo(`/patient/${props.patientId}`);
  await save(s);
}
watch(() => session.value?.phase, (phase) => (phase === "done" || phase === "stopped") && wrapUp(true));
// The patient ended the call with the coach: keep what was done.
watch(coach.state, (st) => st === "ended" && engine.value === "coach" && wrapUp(false));
const endSession = () => wrapUp(false);

// ---- Display ----
const count = computed(() => {
  const s = session.value;
  if (!s || s.phase !== "set") return null;
  return s.mode === "camera" && trackable.value ? currentLog(s).camera ?? 0 : null;
});
const setForm = computed(() => {
  const s = session.value;
  return s && s.phase === "set" ? average(currentLog(s).form.map((r) => r.score)) : null;
});
const levelWidth = computed(() => `${Math.min(100, (coach.micLevel.value / settings.turn.threshold) * 50)}%`);
const caption = computed(() => (engine.value === "coach" ? coach.caption.value : ""));
const speaking = computed(() => coach.state.value === "speaking");
const captionWho = computed(() => (coach.userSpeaking.value ? "you" : "coach"));
const showType = ref(false);
const pulseKey = ref(0);
watch(count, (n, old) => n !== null && n !== old && pulseKey.value++);
// One bar per set across the whole plan.
const setBars = computed(() => {
  const s = session.value;
  if (!s) return [];
  return s.items.flatMap((it, i) =>
    it.log.map((l, n) => ({
      key: `${i}-${n}`,
      done: l.logged !== null || i < s.item || (i === s.item && n + 1 < s.current),
      on: i === s.item && n + 1 === s.current && s.phase === "set",
    })),
  );
});
const sessionTip = computed(() => {
  const s = session.value;
  return s ? mainTip(s.items.flatMap((i) => i.log.flatMap((l) => l.form))) : null;
});

const typed = ref("");
function sendTyped() {
  const text = typed.value.trim();
  if (!text) return;
  coach.say(text);
  checkSafety(text);
  typed.value = "";
}

// ---- SYS-01: safety net that does not depend on the model ----
// Everything the patient says (live transcription, last 10 s) or types is checked for danger signs.
// The coach gets 3 seconds to call report_concern itself; if it has not, the app stops the session.
const speech = new SpeechWindow(10_000);
let safetyTimer: ReturnType<typeof setTimeout> | undefined;
const SAFETY_GRACE_MS = 3000;
function checkSafety(text: string) {
  const s = session.value;
  if (!s || s.phase === "stopped" || s.phase === "done" || safetyTimer) return;
  const flag = detectRedFlags(text, lang.value);
  if (!flag) return;
  safetyTimer = setTimeout(() => {
    safetyTimer = undefined;
    const current = session.value;
    if (!current || current.phase === "stopped" || current.phase === "done") return; // the coach already stopped it
    applyTool(current, "report_concern", { kind: flag.kind, details: text.slice(-200), source: "keyword_fallback" }, Date.now());
    coach.say(
      flag.kind === "distress"
        ? `[APP] Safety: the patient said "${flag.match}". The session is stopped. Speak slowly and gently, say you are glad they told you and that they are not alone, and encourage them to talk to someone they trust now, or call 112 if they might hurt themselves. Their care team has been told.`
        : `[APP] Safety: the patient said "${flag.match}". The session is stopped. Tell them calmly to stop and rest, and to contact their clinic today, or emergency services if it is an emergency. Their care team has been told.`,
    );
  }, SAFETY_GRACE_MS);
}
onBeforeUnmount(() => {
  clearTimeout(safetyTimer);
  coach.stop();
});
const PAIN = Array.from({ length: 11 }, (_, n) => n);
const DIFFS: Difficulty[] = ["easy", "ok", "hard"];
</script>

<template>
  <p v-if="loadError" class="error">{{ loadError }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>
  <div v-if="patient" class="patient-view">
    <!-- Before starting: today's plan, the how-to, and how to start. -->
    <div v-if="!session" class="intro-card">
      <p class="eyebrow">{{ T("sesToday") }}</p>
      <h1>{{ shownExercise?.name[lang] }}</h1>
      <ul class="ses-plan">
        <li v-for="p in planItems" :key="p.exercise.id">
          <NuxtLink :to="`/patient/${patientId}/exercise/${p.exercise.id}`" class="ses-plan-row">
            <span><b>{{ p.exercise.name[lang] }}</b><span class="hint"> · {{ T("setsReps", { sets: p.sets, reps: p.reps }) }}</span></span>
            <span class="link">{{ T("howToDo") }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="trackable && useCamera" class="hint">{{ T(`camPlace_${shownExercise!.id}` as TextKey) }}</p>
      <div class="field">
        <span>{{ T("sesSupport") }}</span>
        <div class="seg seg-full" role="group" :aria-label="T('sesSupport')">
          <button v-for="x in (['alone', 'helper'] as const)" :key="x" :class="{ on: settings.support === x }" @click="settings.support = x">{{ T(`support_${x}`) }}</button>
        </div>
        <span class="hint">{{ settings.support === "alone" ? T("supportAloneHint") : T("supportHelperHint") }}</span>
      </div>
      <p class="hint">{{ T("sesCoachHint") }}</p>
      <button class="primary big-btn pill-btn" @click="ask(true)">{{ T("sesWithCoach") }}</button>
      <button class="link ses-center" @click="ask(false)">{{ T("sesQuiet") }}</button>
      <p class="hint ses-center">{{ T("sesQuietHint") }}</p>
      <button class="link ses-center" @click="showSettings = true"><Settings2 class="ic" aria-hidden="true" /> {{ T("sesSettings") }}</button>
      <PermissionGate ref="gate" :camera="permissionCamera" :mic="startWith === 'coach'" @go="begin(startWith === 'coach')" @without-camera="settings.mode = 'patient'; begin(startWith === 'coach')" />
    </div>

    <!-- During the session: the screen becomes the exercise. -->
    <div v-else class="immersive">
      <div class="imm-top">
        <div class="set-bars"><span v-for="b in setBars" :key="b.key" :class="{ done: b.done, on: b.on }" /></div>
        <div v-if="item" class="bar">
          <b class="imm-title">{{ item.exercise.name[lang] }}</b>
          <span class="on-night-2 hint-night">{{ T("exerciseOf", { n: session.item + 1, m: session.items.length }) }}</span>
        </div>
      </div>

      <div class="imm-stage">
        <PoseTracker
          v-if="useCamera && shownExercise && trackable"
          ref="tracker"
          :exercise-id="shownExercise.id"
          :limb="limbOf(patient.profile)"
          :hold-seconds="shownExercise.holdSeconds"
          :counting="session.phase === 'set' && !paused"
          :model="settings.poseModel"
        @rep="onRep"
          @top="onTop"
        />
        <MediaFrame v-else-if="shownExercise" kind="video" :src="`/media/exercises/${shownExercise.id}.mp4`" :label="T('video')" />

        <span v-if="item && session.phase === 'set'" class="imm-pill glass">{{ T("setOf", { n: session.current, m: item.sets }) }}</span>
        <div v-if="count !== null && item" :key="pulseKey" class="imm-count pulse"><b>{{ count }}</b><span>/ {{ item.reps }}</span></div>
        <div v-if="lastRep?.form && session.phase === 'set'" class="imm-form glass" :class="`band-${formBand(lastRep.form.score)}`">
          <b>{{ lastRep.form.score }}</b>
          <span>{{ lastRep.form.weakest ? T(`formTip_${lastRep.form.weakest}` as TextKey) : T(`formBand_${formBand(lastRep.form.score)}` as TextKey) }}</span>
        </div>

        <!-- Guide engine: pain before -->
        <div v-if="engine === 'guide' && session.phase === 'intro'" class="imm-center imm-panel">
          <b class="imm-q">{{ T("sesPainBefore") }}</b>
          <div class="pain-grid"><button v-for="n in PAIN" :key="n" class="pain-btn" @click="painBefore(n)">{{ n }}</button></div>
          <div class="pain-ends on-night-2"><span>{{ T("sesPainLow") }}</span><span>{{ T("sesPainHigh") }}</span></div>
        </div>
        <!-- Guide engine: ready for the next set -->
        <div v-else-if="engine === 'guide' && session.phase === 'ready' && item" class="imm-center imm-panel">
          <div class="tile-big">{{ T("setOf", { n: session.current, m: item.sets }) }}</div>
          <p class="on-night-2">{{ T("setsReps", { sets: 1, reps: item.reps }) }} · {{ item.exercise.tempo[lang] }}</p>
          <ExerciseVideoButton :exercise-id="item.exercise.id" :level="patient.profile.level" />
          <p v-if="settings.support === 'helper'" class="helper-tip">{{ T("helperTip") }}</p>
          <p v-if="cameraBlind()" class="helper-tip">{{ T("cueCantSee") }}</p>
          <button class="primary big-btn pill-btn" :disabled="cameraBlind()" @click="startSet">{{ T("sesStartSet", { n: session.current }) }}</button>
        </div>
        <!-- Coach engine: waiting for the coach -->
        <div v-else-if="engine === 'coach' && (session.phase === 'intro' || session.phase === 'ready')" class="imm-center">
          <div class="tile-big">{{ T("getReady") }}</div>
          <ExerciseVideoButton v-if="item && session.phase === 'ready'" :exercise-id="item.exercise.id" :level="patient.profile.level" />
          <p v-if="session.painBefore !== null" class="on-night-2">{{ T("painBeforeAfter", { before: session.painBefore, after: "–" }) }}</p>
        </div>
        <!-- Rest -->
        <div v-else-if="session.phase === 'rest'" class="imm-center">
          <ProgressRing :value="(restLeft / restTotal) * 100" />
          <div class="ring-num">{{ restLeft }}</div>
          <b>{{ T("rest") }}</b>
          <div v-if="engine === 'guide' && feel === 'ask'" class="feel">
            <b class="imm-q">{{ T("cueHowFelt") }}</b>
            <div class="diff-row">
              <button class="ghost pill-btn" @click="felt('fine')">{{ T("feltFine") }}</button>
              <button class="ghost pill-btn" @click="felt('hard')">{{ T("feltHard") }}</button>
              <button class="ghost pill-btn" @click="felt('hurts')">{{ T("feltHurts") }}</button>
            </div>
          </div>
          <div v-else-if="engine === 'guide' && feel === 'hurts'" class="feel">
            <b class="imm-q">{{ T("feltHurtsAsk") }}</b>
            <div class="diff-row two">
              <button class="ghost pill-btn" @click="hurtsWorse(true)">{{ T("feltHurtsYes") }}</button>
              <button class="ghost pill-btn" @click="hurtsWorse(false)">{{ T("feltHurtsNo") }}</button>
            </div>
          </div>
          <button v-else class="ghost pill-btn" @click="skipRest">{{ T("skip") }}</button>
        </div>
        <!-- Guide engine: after -->
        <div v-else-if="engine === 'guide' && session.phase === 'after'" class="imm-center imm-panel">
          <template v-if="session.painAfter === null">
            <b class="imm-q">{{ T("sesPainAfter") }}</b>
            <div class="pain-grid"><button v-for="n in PAIN" :key="n" class="pain-btn" @click="painAfter(n)">{{ n }}</button></div>
            <div class="pain-ends on-night-2"><span>{{ T("sesPainLow") }}</span><span>{{ T("sesPainHigh") }}</span></div>
          </template>
          <template v-else>
            <b class="imm-q">{{ T("sesHowHard") }}</b>
            <div class="diff-row"><button v-for="d in DIFFS" :key="d" class="ghost big-btn pill-btn" @click="finish(d)">{{ T(`diff_${d}` as TextKey) }}</button></div>
          </template>
        </div>
        <div v-else-if="session.phase === 'after' || session.phase === 'done'" class="imm-center">
          <div class="tile-big">{{ T("summary") }}</div>
          <p class="on-night-2">{{ T("painBeforeAfter", { before: session.painBefore ?? "–", after: session.painAfter ?? "–" }) }}</p>
          <p v-if="sessionTip" class="on-night-2">{{ T(`formTip_${sessionTip}` as TextKey) }}</p>
        </div>

        <div v-if="paused" class="imm-center imm-panel imm-paused">
          <b class="imm-q">{{ idlePrompt ? T("sesStill") : T("sesPaused") }}</b>
          <button class="primary big-btn pill-btn" @click="resume"><Play class="ic" aria-hidden="true" /> {{ T("sesResume") }}</button>
          <button class="ghost pill-btn" @click="endSession">{{ T("sesEnd") }}</button>
        </div>

        <div v-if="session.concern" class="imm-alert">
          <div><b>{{ T("stopped") }}</b><span>{{ T("next_stop_contact") }}</span></div>
        </div>

        <div v-if="caption" class="imm-caption glass">
          <span class="wave" :class="{ on: speaking || coach.userSpeaking.value, you: captionWho === 'you' }"><i /><i /><i /><i /></span>
          <span><b>{{ captionWho === "you" ? T("you") : T("coach") }}:</b> {{ caption }}</span>
        </div>
      </div>

      <div>
        <p v-if="coachDown" class="on-night-2 ses-center">{{ T("sesCoachBusy") }}</p>
        <div v-if="engine === 'guide' && session.phase === 'set' && !paused" class="imm-controls">
          <template v-if="count === null">
            <button :aria-label="'-1'" @click="manualReps = Math.max(0, manualReps - 1)"><Minus class="ic" aria-hidden="true" /></button>
            <b class="manual-reps">{{ manualReps }}</b>
            <button :aria-label="'+1'" @click="manualReps++"><Plus class="ic" aria-hidden="true" /></button>
          </template>
          <button class="primary" @click="finishSet">{{ T("sesFinishSet") }}</button>
        </div>
        <div v-if="session.phase !== 'done' && session.phase !== 'stopped'" class="imm-controls">
          <button v-if="!paused" @click="pause()"><Pause class="ic" aria-hidden="true" /> {{ T("sesPause") }}</button>
          <template v-if="live">
            <button @click="coach.toggleMic()">{{ coach.micOn.value ? T("mute") : T("unmute") }}</button>
            <button @click="showType = !showType">{{ T("typeBtn") }}</button>
          </template>
          <button class="end" @click="feelWrong"><CircleAlert class="ic" aria-hidden="true" /> {{ T("sesFeelWrong") }}</button>
        </div>
        <div v-if="live" class="mic-level" aria-hidden="true"><i :style="{ width: levelWidth }" /></div>
        <form v-if="live && showType" class="imm-type" @submit.prevent="sendTyped">
          <input v-model="typed" :placeholder="T('typeInstead')" />
          <button class="primary pill-btn">{{ T("send") }}</button>
        </form>
        <p v-if="setForm !== null && session.phase === 'set'" class="on-night-2 ses-center">{{ T("formSession") }}: {{ setForm }}</p>
        <p v-if="saving" class="on-night-2 ses-center">{{ T("saving") }}</p>
        <p v-if="coach.error.value && engine === 'coach'" class="night-error">{{ coach.error.value }}</p>
        <div v-if="saveError" class="save-retry" role="alert">
          <p class="night-error">{{ T("notSavedYet") }}</p>
          <button class="primary big-btn" :disabled="saving" @click="sendPending()">{{ T("tryAgain") }}</button>
        </div>
      </div>
    </div>

    <UiSheet :open="showSettings" :title="T('sesSettings')" @close="showSettings = false; saveSettings()">
      <div class="stack">
        <p class="hint">{{ T("sesCounting") }}</p>
        <div class="seg seg-full" role="group" :aria-label="T('sesCounting')">
          <button v-for="m in (['camera', 'patient', 'coach'] as const)" :key="m" :class="{ on: settings.mode === m }" @click="settings.mode = m">{{ T(`count_${m}`) }}</button>
        </div>
        <p class="hint">{{ T("sesVoice") }}</p>
        <div class="voice-grid">
          <button v-for="v in VOICES" :key="v" class="ghost small-btn" :class="{ on: settings.voice === v }" :aria-pressed="settings.voice === v" @click="settings.voice = v">{{ v }}</button>
        </div>
      </div>
    </UiSheet>
  </div>
</template>

<style scoped>
.ses-plan { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.ses-plan-row { display: flex; justify-content: space-between; gap: 10px; align-items: center; min-height: 52px; padding: 8px 12px; border-radius: 12px; background: var(--sunken); color: var(--ink); text-decoration: none; }
.ses-center { text-align: center; justify-self: center; display: inline-flex; gap: 6px; align-items: center; }
.imm-panel { gap: 12px; padding: 0 16px; }
.imm-q { font-size: 1.25rem; text-align: center; }
.pain-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; width: min(100%, 360px); }
.pain-btn { min-height: 52px; border-radius: 14px; border: 1px solid var(--night-line); background: var(--night-raised); color: var(--on-night); font: 700 1.25rem/1 var(--display); cursor: pointer; transition: transform var(--dur-press) var(--ease-out); }
.pain-btn:active { transform: scale(0.94); }
.pain-ends { display: flex; justify-content: space-between; width: min(100%, 360px); font-size: 0.8125rem; }
.diff-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: min(100%, 360px); }
.imm-paused { position: absolute; inset: 0; background: color-mix(in srgb, var(--night) 86%, transparent); }
.imm-form { position: absolute; left: 12px; bottom: 12px; max-width: 70%; display: grid; gap: 2px; padding: 8px 12px; border-radius: 14px; }
.imm-form b { font: 700 1.5rem/1 var(--display); }
.imm-form.band-great b, .imm-form.band-good b { color: var(--dawn); }
.manual-reps { font: 700 1.5rem/1 var(--display); min-width: 2ch; text-align: center; align-self: center; }
.mic-level { height: 3px; margin-top: 8px; border-radius: 2px; background: var(--night-line); overflow: hidden; }
.mic-level i { display: block; height: 100%; background: var(--dawn); transition: width 80ms linear; }
.voice-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.feel { display: grid; gap: 10px; justify-items: center; width: 100%; }
.diff-row.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.helper-tip { margin: 0; max-width: 360px; padding: 10px 12px; border-radius: 12px; background: var(--night-raised); color: var(--on-night); font-size: 0.9375rem; text-align: left; }
.voice-grid .on { background: var(--ink); color: var(--surface); }
</style>
