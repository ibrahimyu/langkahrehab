<script setup lang="ts">
import { exerciseById } from "#shared/exercises";
import type { TextKey } from "#shared/i18n";
import { limbOf, type Patient, type SessionRecord } from "#shared/model";
import type { RepEvent } from "#shared/pose";
import type { Scenario } from "#shared/scenarios";
import { applyTool, createSession, currentItem, currentLog, endRest, results, toRecordExercises, type Session } from "#shared/session";
import { VOICES, defaultSettings, parseSettings, type Settings } from "#shared/settings";
import type { LiveGrant } from "../composables/useLiveCoach";

// One exercise session over the whole plan: live (voice coach + camera) or simulated.
const props = defineProps<{ patientId: string; simulation?: Scenario["simulation"] }>();
const emit = defineEmits<{ saved: [sessionId: string] }>();

const SETTINGS_KEY = "langkah-session-settings";
const api = useApi();
const lang = useLang();
const T = useT();
const version = useDataVersion();

const patient = ref<Patient | null>(null);
const loadError = ref("");
const settings = reactive<Settings>(structuredClone(defaultSettings));
const session = ref<Session | null>(null);

onMounted(async () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) Object.assign(settings, parseSettings(JSON.parse(saved)));
  } catch {}
  try {
    patient.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient;
  } catch (e) {
    loadError.value = errorMessage(e);
  }
});

function buildSession(mode = settings.mode) {
  const items = patient.value!.plan.items
    .map((i) => ({ exercise: exerciseById(i.exerciseId)!, sets: i.sets, reps: i.reps }))
    .filter((i) => i.exercise);
  session.value = createSession(mode, items);
}

// ---- Live coach ----
let midSetIndex: { item: number; set: number } | null = null;
const coach = useLiveCoach({
  fetchGrant: (s) => api<LiveGrant>("/api/live-token", { method: "POST", body: { patientId: props.patientId, settings: s, lang: lang.value } }),
  onTool: (name, args) => {
    const s = session.value!;
    if (name === "save_memory" || name === "log_diary") {
      const path = name === "save_memory" ? "memories" : "diary";
      api(`/api/patients/${props.patientId}/${path}`, { method: "POST", body: { ...args, source: "coach" } }).catch(() => {});
      return { ok: true };
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
const live = computed(() => ["connecting", "listening", "speaking"].includes(coach.state.value));

// ---- Camera ----
const tracker = ref<{ reset: () => void; start: () => Promise<void>; stop: () => void } | null>(null);
const CUE_GAP_MS = 8000;
const cueWords = { hold_longer: "hold a little longer at the top", slow_down: "move a little more slowly" } as const;
let lastCueAt = 0;
let targetSent = false;
function onRep(e: RepEvent) {
  const s = session.value!;
  if (s.phase !== "set" || !live.value) return;
  currentLog(s).camera = e.count;
  if (e.count >= currentItem(s).reps && !targetSent) {
    targetSent = true;
    coach.say(`[APP] The camera counted ${e.count} reps, the target for this set. Call log_set now.`);
    return;
  }
  coach.addContext(`[APP] Camera: rep ${e.count} of ${currentItem(s).reps}.`);
  if (e.cue && Date.now() - lastCueAt > CUE_GAP_MS) {
    lastCueAt = Date.now();
    coach.say(`[APP] Camera cue: tell the patient to ${cueWords[e.cue]}, in a few words.`);
  }
}

watch(
  () => session.value?.phase,
  (p) => {
    coach.setSetActive(p === "set");
    if (p === "set") {
      tracker.value?.reset();
      lastCueAt = 0;
      targetSent = false;
    }
  },
);

async function begin() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  const s = parseSettings(JSON.parse(JSON.stringify(settings)));
  Object.assign(settings, s);
  buildSession();
  await nextTick();
  if (s.mode === "camera") void tracker.value?.start();
  await coach.start(s);
}

// ---- Rest timer: the app, not the model, decides when rest is over ----
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => (tick = setInterval(() => (now.value = Date.now()), 250)));
onBeforeUnmount(() => clearInterval(tick));
const restLeft = computed(() => {
  const until = session.value?.restUntil;
  return until ? Math.max(0, Math.ceil((until - now.value) / 1000)) : 0;
});
watch(restLeft, (left) => {
  const s = session.value;
  if (left > 0 || s?.phase !== "rest" || simulating.value) return;
  const message = endRest(s);
  if (message) coach.say(message);
});
const skipRest = () => session.value && (session.value.restUntil = Date.now());

// ---- Save when the session ends ----
const saving = ref(false);
const saveError = ref("");
let saved = false;
async function save(s: Session, phantomPain: number | null = null) {
  saving.value = true;
  // A set cut short (stopped for a danger sign) keeps the reps the camera counted.
  for (const it of s.items) for (const l of it.log) if (l.logged === null && l.camera !== null) l.logged = l.camera;
  try {
    if (phantomPain !== null)
      await api(`/api/patients/${props.patientId}/diary`, { method: "POST", body: { kind: "phantom_pain", score: phantomPain, source: "coach" } });
    const res = await api<{ session: SessionRecord }>(`/api/patients/${props.patientId}/sessions`, {
      method: "POST",
      body: {
        lang: lang.value,
        mode: s.mode,
        exercises: toRecordExercises(s),
        painBefore: s.painBefore,
        painAfter: s.painAfter,
        difficulty: s.difficulty,
        concern: s.concern && { kind: s.concern.kind, details: s.concern.details },
      },
    });
    version.value++;
    emit("saved", res.session.id);
  } catch (e) {
    saveError.value = errorMessage(e, "Could not save the session.");
    saving.value = false;
  }
}
watch([() => session.value?.phase, coach.state], async ([phase, state]) => {
  const s = session.value;
  const over = phase === "done" || phase === "stopped" || state === "ended" || state === "error";
  if (!s || saved || simulating.value || !over || s.painBefore === null) return;
  saved = true;
  // Let the coach finish its last sentence.
  if (phase === "done" || phase === "stopped") await new Promise((r) => setTimeout(r, 4000));
  coach.stop();
  tracker.value?.stop();
  await save(s);
});

// ---- Simulated session: plays an example and saves it like a real one ----
const simulating = ref(false);
const simCaption = ref<{ who: "coach" | "you"; text: string } | null>(null);
const simCount = ref<number | null>(null);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function simulate() {
  const sim = props.simulation ?? { painBefore: 2, painAfter: 3, phantomPain: null, logged: [], difficulty: "ok" as const };
  simulating.value = true;
  buildSession("camera");
  const s = session.value!;
  const say = async (who: "coach" | "you", key: TextKey, params?: Record<string, string | number>, ms = 1400) => {
    simCaption.value = { who, text: T(key, params) };
    await wait(ms);
  };
  await say("coach", "sim_greet", { name: patient.value!.name });
  await say("you", "sim_pain", { n: sim.painBefore }, 900);
  applyTool(s, "record_pain", { when: "before", score: sim.painBefore }, Date.now());
  if (sim.phantomPain !== null) {
    await say("coach", "sim_phantom");
    await say("you", "sim_pain", { n: sim.phantomPain }, 900);
  }
  if (sim.memory) {
    simCaption.value = { who: "you", text: sim.memory.said[lang.value] };
    await wait(2000);
    await api(`/api/patients/${props.patientId}/memories`, { method: "POST", body: { kind: sim.memory.kind, text: sim.memory.text[lang.value], source: "coach" } });
    await say("coach", "sim_goal_coach", {}, 1500);
  }
  for (const [i, item] of s.items.entries()) {
    const logged = sim.logged[i] ?? item.log.map(() => item.reps);
    for (let set = 1; set <= item.sets; set++) {
      const reps = logged[set - 1] ?? null;
      if (reps === null) continue;
      if (s.phase === "rest") endRest(s);
      if (s.item !== i || s.current !== set) {
        s.item = i;
        s.current = set;
        s.phase = "ready";
      }
      if (set === 1) await say("coach", "sim_start", { exercise: item.exercise.name[lang.value] }, 1100);
      applyTool(s, "start_set", { set }, Date.now());
      for (let n = 1; n <= reps; n++) {
        simCount.value = n;
        currentLog(s).camera = n;
        if (n === Math.ceil(reps / 2) && set === 1 && i === 0) simCaption.value = { who: "coach", text: T("sim_cue") };
        await wait(260);
      }
      if (sim.concern && i === 0 && set === 1) {
        await say("you", "sim_danger_patient", {}, 1600);
        applyTool(s, "report_concern", { kind: sim.concern.kind, details: sim.concern.details }, Date.now());
        await say("coach", "sim_danger_coach", {}, 2200);
        simCount.value = null;
        await save(s, sim.phantomPain);
        return;
      }
      applyTool(s, "log_set", { set, reps }, Date.now());
      simCount.value = null;
      await say("coach", "sim_set_done", { n: reps }, 900);
    }
  }
  s.phase = "after";
  await say("coach", "sim_pain_after");
  await say("you", "sim_pain", { n: sim.painAfter }, 900);
  applyTool(s, "record_pain", { when: "after", score: sim.painAfter }, Date.now());
  applyTool(s, "finish_session", { difficulty: sim.difficulty }, Date.now());
  await say("coach", "sim_close", {}, 1000);
  await save(s, sim.phantomPain);
}

// ---- Display ----
const item = computed(() => (session.value ? currentItem(session.value) : null));
const count = computed(() => {
  if (simulating.value) return simCount.value;
  const s = session.value;
  if (!s || s.phase !== "set") return null;
  return s.mode === "camera" ? currentLog(s).camera ?? 0 : null;
});
const firstExercise = computed(() => (patient.value ? exerciseById(patient.value.plan.items[0]?.exerciseId ?? "") : undefined));
const shownExercise = computed(() => item.value?.exercise ?? firstExercise.value);
const levelWidth = computed(() => `${Math.min(100, (coach.micLevel.value / settings.turn.threshold) * 50)}%`);
const rows = computed(() => (session.value ? results(session.value) : []));
const caption = computed(() => (simulating.value ? simCaption.value?.text : coach.caption.value) || "");

const running = computed(() => !!session.value);
const speaking = computed(() => (simulating.value ? simCaption.value?.who === "coach" : coach.state.value === "speaking"));
const captionWho = computed(() => (simulating.value ? simCaption.value?.who ?? "coach" : coach.userSpeaking.value ? "you" : "coach"));
const restTotal = computed(() => (session.value ? currentItem(session.value).exercise.restSeconds : 30));
const showType = ref(false);
// Re-keying the counter replays its pulse on every rep.
const pulseKey = ref(0);
watch(count, (n, old) => {
  if (n !== null && n !== old) pulseKey.value++;
});
// One bar per set across the whole plan.
const setBars = computed(() => {
  const s = session.value;
  if (!s) return [];
  return s.items.flatMap((it, i) =>
    it.log.map((l, n) => ({
      key: `${i}-${n}`,
      done: l.logged !== null || i < s.item || (i === s.item && n + 1 < s.current),
      on: i === s.item && n + 1 === s.current && (s.phase === "set" || simCount.value !== null),
    })),
  );
});

const typed = ref("");
function sendTyped() {
  if (!typed.value.trim()) return;
  coach.say(typed.value.trim());
  typed.value = "";
}
</script>

<template>
  <p v-if="loadError" class="error">{{ loadError }}</p>
  <div v-if="patient" class="patient-view">
    <!-- Before starting: what to do, and how (coach or simulation). -->
    <div v-if="!running" class="intro-card">
      <p class="eyebrow">{{ T("today") }}</p>
      <h1>{{ shownExercise?.name[lang] }}</h1>
      <MediaFrame v-if="shownExercise" kind="video" :src="`/media/exercises/${shownExercise.id}.mp4`" :poster="`/media/exercises/${shownExercise.id}.jpg`" :label="T('video')" style="aspect-ratio: 16 / 9; border-radius: 22px" />
      <p v-if="shownExercise" class="hint">{{ shownExercise.instructions[lang] }}</p>
      <button class="primary big-btn pill-btn" @click="begin">{{ T("connect") }}</button>
      <button class="ghost big-btn pill-btn" @click="simulate">{{ T("simulate") }}</button>
      <p class="sim-note">{{ T("simHint") }}</p>
    </div>

    <!-- During the session: the screen becomes the exercise. -->
    <div v-else class="immersive">
      <div class="imm-top">
        <div class="set-bars"><span v-for="b in setBars" :key="b.key" :class="{ done: b.done, on: b.on }" /></div>
        <div class="bar" v-if="item">
          <b style="font-size: 18px">{{ item.exercise.name[lang] }}</b>
          <span style="color: #9cbad3; font-size: 13px">{{ T("exerciseOf", { n: session!.item + 1, m: session!.items.length }) }}<template v-if="simulating"> · {{ T("simulating") }}</template></span>
        </div>
      </div>

      <div class="imm-stage">
        <PoseTracker
          v-if="settings.mode === 'camera' && shownExercise && !simulating"
          ref="tracker"
          :exercise-id="shownExercise.id"
          :limb="limbOf(patient.profile)"
          :hold-seconds="shownExercise.holdSeconds"
          :counting="session?.phase === 'set'"
          :model="settings.poseModel"
          compact
          @rep="onRep"
        />
        <MediaFrame v-else-if="shownExercise" kind="video" :src="`/media/exercises/${shownExercise.id}.mp4`" :label="T('video')" />

        <span v-if="item && (session!.phase === 'set' || simCount !== null)" class="imm-pill glass">{{ T("setOf", { n: session!.current, m: item.sets }) }}</span>
        <div v-if="count !== null && item" :key="pulseKey" class="imm-count pulse"><b>{{ count }}</b><span>/ {{ item.reps }}</span></div>

        <div v-if="session!.phase === 'rest' && !simulating" class="imm-center">
          <ProgressRing :value="(restLeft / restTotal) * 100" />
          <div class="ring-num">{{ restLeft }}</div>
          <b>{{ T("rest") }}</b>
          <button class="ghost pill-btn" @click="skipRest">{{ T("skip") }}</button>
        </div>
        <div v-else-if="(session!.phase === 'intro' || session!.phase === 'ready') && simCount === null" class="imm-center">
          <div class="tile-big">{{ T("getReady") }}</div>
          <p v-if="session!.painBefore !== null" style="color: #c9daea">{{ T("painBeforeAfter", { before: session!.painBefore, after: "–" }) }}</p>
        </div>
        <div v-else-if="session!.phase === 'after' || session!.phase === 'done'" class="imm-center">
          <div class="tile-big">{{ T("summary") }}</div>
          <p style="color: #c9daea">{{ T("painBeforeAfter", { before: session!.painBefore ?? "–", after: session!.painAfter ?? "–" }) }}</p>
        </div>

        <div v-if="session!.concern" class="imm-alert">
          <div><b>{{ T("stopped") }}</b><span>{{ T("next_stop_contact") }}</span></div>
        </div>

        <div v-if="caption" class="imm-caption glass">
          <span class="wave" :class="{ on: speaking || coach.userSpeaking.value, you: captionWho === 'you' }"><i /><i /><i /><i /></span>
          <span><b>{{ captionWho === "you" ? T("you") : T("coach") }}:</b> {{ caption }}</span>
        </div>
      </div>

      <div>
        <div v-if="live" class="imm-controls">
          <button @click="coach.toggleMic()">{{ coach.micOn.value ? T("mute") : T("unmute") }}</button>
          <button @click="showType = !showType">{{ T("typeBtn") }}</button>
          <button class="end" @click="coach.stop()">{{ T("end") }}</button>
        </div>
        <form v-if="live && showType" class="imm-type" style="margin-top: 8px" @submit.prevent="sendTyped">
          <input v-model="typed" :placeholder="T('typeInstead')" />
          <button class="primary pill-btn">{{ T("send") }}</button>
        </form>
        <p v-if="saving" style="color: #c9daea; text-align: center">{{ T("saving") }}</p>
        <p v-if="coach.error.value" class="error" style="color: #f8b4ae">{{ coach.error.value }}</p>
        <p v-if="saveError" class="error" style="color: #f8b4ae">{{ saveError }}</p>
      </div>
    </div>

    <details v-if="!running || !simulating" class="card dev">
      <summary>Details for testers</summary>
      <div class="row">
        <label>
          <span>Counting</span>
          <select v-model="settings.mode" :disabled="live">
            <option value="camera">Camera + voice</option>
            <option value="patient">Patient counts aloud</option>
            <option value="coach">Coach counts the tempo</option>
          </select>
        </label>
        <label>
          <span>Turn detection</span>
          <select v-model="settings.turn.kind" :disabled="live">
            <option value="app">App-controlled</option>
            <option value="auto">Gemini automatic</option>
          </select>
        </label>
        <label>
          <span>Voice</span>
          <select v-model="settings.voice" :disabled="live">
            <option v-for="v in VOICES" :key="v" :value="v">{{ v }}</option>
          </select>
        </label>
        <label>
          <span>Pose model</span>
          <select v-model="settings.poseModel" :disabled="live">
            <option value="full">Full</option>
            <option value="lite">Lite</option>
          </select>
        </label>
      </div>
      <label class="check inline"><input v-model="settings.askDiary" type="checkbox" :disabled="live" /> Ask about phantom limb pain</label>
      <table>
        <thead><tr><th>Exercise</th><th>Set</th><th>Heard</th><th>Camera</th><th>Logged</th><th>Secs</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="`${r.exercise}-${r.set}`">
            <td>{{ r.exercise }}</td><td>{{ r.set }}</td><td>{{ r.heard ?? "–" }}</td><td>{{ r.camera ?? "–" }}</td><td>{{ r.logged ?? "–" }}</td><td>{{ r.seconds ?? "–" }}</td>
          </tr>
        </tbody>
      </table>
      <p class="hint">Median reply gap {{ coach.medianReplyGap.value ?? "–" }} ms · interruptions {{ coach.interruptions.value }}</p>
      <div class="transcript">
        <p v-for="(l, i) in coach.lines.value" :key="i" :class="l.role"><b>{{ l.role }}</b> {{ l.text }}</p>
      </div>
      <div class="log">
        <p v-for="(e, i) in coach.log.value" :key="i"><span>{{ (e.t / 1000).toFixed(2) }}s</span> <b>{{ e.kind }}</b> {{ e.detail }}</p>
      </div>
    </details>
  </div>
</template>
