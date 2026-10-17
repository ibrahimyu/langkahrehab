<script setup lang="ts">
import type { Component } from "vue";
import { ArrowLeft, ArrowRight, Camera, Check, ExternalLink, Gauge, ListChecks, Move, OctagonAlert, PhoneCall, Play, RotateCcw, TriangleAlert, UserRound, X } from "lucide-vue-next";
import { holdLines, repLine } from "#shared/cues";
import { exerciseById } from "#shared/exercises";
import { CLINIC_PHONE } from "#shared/family";
import { average, formBand, type RepScore } from "#shared/form";
import type { TextKey } from "#shared/i18n";
import { limbOf, type Patient } from "#shared/model";
import type { RepEvent } from "#shared/pose";
import { tracking } from "#shared/pose";
import { CHAPTERS, chapterTitle, tutorSteps } from "#shared/tutor";
import { embedUrl, videoFor, watchUrl } from "#shared/videos";

// Video tutor for one exercise: clinician video, five chapters to step through (read aloud),
// and a practice mode where the camera counts and scores a few reps without saving anything.
const props = defineProps<{ patientId: string; exerciseId: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();

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

const exercise = computed(() => exerciseById(props.exerciseId));
const planItem = computed(() => patient.value?.plan.items.find((i) => i.exerciseId === props.exerciseId));
const steps = computed(() => (exercise.value && patient.value ? tutorSteps(exercise.value, lang.value, patient.value.profile) : []));
const step = ref(0);
// Prepare checklist (ticked on this screen only) and swiping between chapters.
const ready = ref(new Set<number>());
const toggleReady = (i: number) => {
  const next = new Set(ready.value);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  ready.value = next;
};
let touchX = 0;
const swipeStart = (e: TouchEvent) => (touchX = e.touches[0]?.clientX ?? 0);
function swipeEnd(e: TouchEvent) {
  const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
  if (Math.abs(dx) < 60) return;
  if (dx < 0 && step.value < steps.value.length - 1) step.value++;
  if (dx > 0 && step.value > 0) step.value--;
}
const chapterIcon: Record<(typeof CHAPTERS)[number], Component> = { prepare: ListChecks, start: UserRound, move: Move, mistakes: TriangleAlert, stop: OctagonAlert };
const current = computed(() => steps.value[step.value]);
const readText = computed(() => current.value?.lines.join(" ") ?? "");

// ---- Video (YouTube player API over postMessage, so speed and replay work without loading a script) ----
const video = computed(() => (patient.value ? videoFor(props.exerciseId, patient.value.profile.level) : null));
const frame = ref<HTMLIFrameElement | null>(null);
const slow = ref(false);
const playing = ref(false);
const src = computed(() => (video.value ? `${embedUrl(video.value, lang.value)}&enablejsapi=1&autoplay=1` : ""));
function command(func: string, args: unknown[] = []) {
  frame.value?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
}
function setSpeed(on: boolean) {
  slow.value = on;
  command("setPlaybackRate", [on ? 0.75 : 1]);
}
function again() {
  command("seekTo", [0, true]);
  command("playVideo");
}

// ---- Practice with the camera ----
const trackable = computed(() => !!patient.value && !!tracking(props.exerciseId, limbOf(patient.value.profile)) && !tracking(props.exerciseId, limbOf(patient.value.profile))?.unsupported);
const practising = ref(false);
const gate = ref<{ ask: () => Promise<void> } | null>(null);
const tracker = ref<{ start: () => Promise<void>; stop: () => void; reset: () => void } | null>(null);
const reps = ref<RepScore[]>([]);
const events = ref<RepEvent[]>([]);
const analysis = ref(false);
const showDemo = ref(true);
// Spoken coaching while practising: the phone may be on the floor, out of reach of the eyes.
const voice = useReadAloud();
let lastCorrection: number | null = null;
let holdTimers: ReturnType<typeof setTimeout>[] = [];
const clearHold = () => (holdTimers.forEach(clearTimeout), (holdTimers = []));
onBeforeUnmount(clearHold);
function onTop() {
  clearHold();
  holdLines(exercise.value?.holdSeconds ?? 0, lang.value).forEach((text, i) => holdTimers.push(setTimeout(() => (i === 0 ? voice.speak(text) : voice.queue(text)), i * 1000)));
}
const last = computed(() => reps.value.at(-1) ?? null);
const avg = computed(() => average(reps.value.map((r) => r.score)));
async function startPractice() {
  reps.value = [];
  events.value = [];
  lastCorrection = null;
  practising.value = true;
  await nextTick();
  await tracker.value?.start();
}
function stopPractice() {
  tracker.value?.stop();
  practising.value = false;
}
function onRep(e: RepEvent) {
  if (e.form) reps.value = [...reps.value, e.form];
  events.value = [...events.value, { ...e }];
  clearHold();
  const line = repLine(e, planItem.value?.reps ?? exercise.value?.reps ?? 10, props.exerciseId, lang.value, lastCorrection);
  if (line.corrected) lastCorrection = e.count;
  voice.speak(line.text);
}
</script>

<template>
  <div class="app-col tutor">
    <NuxtLink :to="`/patient/${patientId}/exercise`" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("sesToday") }}</NuxtLink>
    <p v-if="loadError" class="error">{{ loadError }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>
    <div v-else-if="!patient" class="card tut-loading" aria-busy="true" />

    <template v-else-if="exercise">
      <header class="tut-head">
        <p class="eyebrow">{{ T("howToDo") }}</p>
        <h1>{{ exercise.name[lang] }}</h1>
        <p class="hint">
          {{ T("tutDose", { sets: planItem?.sets ?? exercise.sets, reps: planItem?.reps ?? exercise.reps }) }}<template v-if="exercise.holdSeconds"> · {{ T("tutHoldShort", { n: exercise.holdSeconds }) }}</template>
        </p>
      </header>

      <section v-if="video" class="tut-video">
        <div class="video-frame">
          <iframe v-if="playing" ref="frame" :src="src" :title="video.title" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" />
          <button v-else class="tut-play" :aria-label="T('video')" @click="playing = true">
            <img :src="`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`" alt="" />
            <span class="tut-play-btn"><Play class="ic" aria-hidden="true" /></span>
          </button>
        </div>
        <div v-if="playing" class="tut-controls">
          <button class="ghost small-btn" @click="again"><RotateCcw class="ic" aria-hidden="true" /> {{ T("tutWatchAgain") }}</button>
          <button class="ghost small-btn" :aria-pressed="slow" @click="setSpeed(!slow)"><Gauge class="ic" aria-hidden="true" /> {{ slow ? T("tutNormal") : T("tutSlow") }}</button>
        </div>
        <p class="hint">{{ T("videoBy", { source: video.channel }) }} · {{ T(`videoSource_${video.source}` as TextKey) }} · <a :href="watchUrl(video)" target="_blank" rel="noopener" class="link with-ic">YouTube <ExternalLink class="ic" aria-hidden="true" /></a></p>
        <p class="note">{{ T("videoSafety") }}</p>
      </section>
      <p v-else class="note">{{ T("tutNoVideo") }}</p>

      <section class="tut-steps" aria-live="polite">
        <!-- Stepper: five chapters, each a dot with its icon; tap to jump, swipe the card to move. -->
        <ol class="stepper" role="tablist">
          <li v-for="(c, i) in CHAPTERS" :key="c" :class="{ on: step === i, done: i < step, stop: c === 'stop' }">
            <button role="tab" :aria-selected="step === i" :aria-label="T(chapterTitle[c])" @click="step = i"><component :is="chapterIcon[c]" class="ic" aria-hidden="true" /></button>
          </li>
        </ol>

        <article v-if="current" :key="current.chapter" class="tut-card" :class="`ch-${current.chapter}`" @touchstart.passive="swipeStart" @touchend.passive="swipeEnd">
          <header class="tut-band">
            <span class="tut-badge" aria-hidden="true"><component :is="chapterIcon[current.chapter]" class="ic" /></span>
            <span class="tut-kicker">{{ T("tutStepOf", { n: step + 1, m: steps.length }) }}</span>
            <h2>{{ T(chapterTitle[current.chapter]) }}</h2>
            <UiReadAloud class="tut-read" :text="readText" />
          </header>

          <div class="tut-body">
            <!-- Prepare: a checklist to tick -->
            <ul v-if="current.chapter === 'prepare'" class="checklist">
              <li v-for="(l, i) in current.lines" :key="i">
                <label :class="{ ticked: ready.has(i) }">
                  <input type="checkbox" :checked="ready.has(i)" @change="toggleReady(i)" />
                  <span class="box" aria-hidden="true"><Check class="ic" /></span>
                  <span>{{ l }}</span>
                </label>
              </li>
            </ul>

            <!-- Start position: one clear sentence -->
            <p v-else-if="current.chapter === 'start'" class="tut-lead">{{ current.lines[0] }}</p>

            <!-- Movement: numbered steps on a line, then the rhythm -->
            <template v-else-if="current.chapter === 'move'">
              <ol class="timeline">
                <li v-for="(l, i) in current.steps" :key="i"><span class="dot" aria-hidden="true">{{ i + 1 }}</span><span>{{ l }}</span></li>
              </ol>
              <div class="rhythm">
                <span class="rhythm-label">{{ T("tutRhythm") }}</span>
                <span class="rhythm-row">
                  <template v-for="(w, i) in current.tempo" :key="i">
                    <span class="beat" :class="{ hold: current.holdSeconds && i === 1 }">{{ w }}<small v-if="current.holdSeconds && i === 1">&nbsp;{{ current.holdSeconds }} {{ T("seconds") }}</small></span>
                    <ArrowRight v-if="i < (current.tempo?.length ?? 0) - 1" class="ic beat-arrow" aria-hidden="true" />
                  </template>
                </span>
              </div>
            </template>

            <!-- Mistakes: what to avoid, and what to do instead -->
            <ul v-else-if="current.chapter === 'mistakes'" class="pairs">
              <li v-for="(m, i) in current.mistakes" :key="i">
                <p class="avoid"><X class="ic" aria-hidden="true" /> {{ m.wrong }}</p>
                <p class="instead"><Check class="ic" aria-hidden="true" /> {{ m.right }}</p>
              </li>
            </ul>

            <!-- When to stop: a warning, with the clinic one tap away -->
            <template v-else>
              <ul class="stops">
                <li v-for="(l, i) in current.lines" :key="i"><OctagonAlert class="ic" aria-hidden="true" /> {{ l }}</li>
              </ul>
              <a class="ghost big-btn stop-call" :href="`tel:${CLINIC_PHONE.replace(/[^\d+]/g, '')}`"><PhoneCall class="ic" aria-hidden="true" /> {{ T("famCallClinic") }}</a>
            </template>
          </div>
        </article>

        <div class="tut-nav">
          <button class="ghost big-btn" :disabled="step === 0" @click="step--"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("back") }}</button>
          <button v-if="step < steps.length - 1" class="primary big-btn" @click="step++">{{ T(chapterTitle[CHAPTERS[step + 1]!]) }} <ArrowRight class="ic" aria-hidden="true" /></button>
          <a v-else href="#practice" class="primary big-btn">{{ T("tutPractice") }} <ArrowRight class="ic" aria-hidden="true" /></a>
        </div>
      </section>

      <section id="practice" class="card tut-practice">
        <h2 class="tut-title"><Camera class="ic" aria-hidden="true" /> {{ T("tutPractice") }}</h2>
        <template v-if="trackable">
          <p class="hint">{{ T("tutPracticeHint") }}</p>
          <p class="hint">{{ T(`camPlace_${exerciseId}` as TextKey) }}</p>
          <div v-if="practising" class="tut-split">
          <ExerciseDemo v-if="showDemo" :exercise-id="exerciseId" :level="patient.profile.level" @hide="showDemo = false" />
          <div class="tut-cam">
            <PoseTracker ref="tracker" :exercise-id="exerciseId" :limb="limbOf(patient.profile)" :hold-seconds="exercise.holdSeconds" :counting="true" model="full" :analysis="analysis" @rep="onRep" @top="onTop" />
            <div class="tut-score glass">
              <b class="tut-count">{{ reps.length }}</b>
              <span v-if="last">{{ T("formRep", { n: reps.length }) }} · <b>{{ last.score }}</b></span>
              <span v-if="last?.weakest">{{ T(`formTip_${last.weakest}` as TextKey) }}</span>
              <span v-else-if="last">{{ T(`formBand_${formBand(last.score)}` as TextKey) }}</span>
            </div>
          </div>
          </div>
          <label class="check inline"><input v-model="analysis" type="checkbox" /> {{ T("labShow") }}</label>
          <div v-if="analysis && events.length" class="lab-table-wrap">
            <table class="lab-table">
              <thead><tr><th>#</th><th>{{ T("labPeak") }}</th><th>{{ T("formPart_hold") }}</th><th>{{ T("labTime") }}</th><th>{{ T("formPart_range") }}</th><th>{{ T("formPart_pace") }}</th><th>{{ T("formSession") }}</th></tr></thead>
              <tbody>
                <tr v-for="e in events" :key="e.count">
                  <td>{{ e.count }}</td><td>{{ e.peak }}°</td><td>{{ (e.heldMs / 1000).toFixed(1) }} s</td><td>{{ (e.durationMs / 1000).toFixed(1) }} s</td>
                  <td>{{ Math.round((e.form?.range ?? 0) * 100) }}</td><td>{{ Math.round((e.form?.pace ?? 0) * 100) }}</td><td><b>{{ e.form?.score ?? "–" }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="avg !== null && !practising" class="tut-result">{{ T("formSession") }}: <b>{{ avg }}</b> · {{ T(`formBand_${formBand(avg)}` as TextKey) }}</p>
          <button v-if="!practising" class="ghost big-btn" @click="gate?.ask()"><Camera class="ic" aria-hidden="true" /> {{ T("tutPractice") }}</button>
          <button v-else class="ghost big-btn" @click="stopPractice">{{ T("tutPracticeStop") }}</button>
          <PermissionGate ref="gate" :camera="true" :mic="false" @go="startPractice" />
        </template>
        <p v-else class="hint">{{ T("tutNoTrack") }}</p>
      </section>

      <NuxtLink :to="`/patient/${patientId}/session`" class="primary big-btn tut-go">{{ T("tutStartSession") }} <ArrowRight class="ic" aria-hidden="true" /></NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.tut-loading { min-height: 260px; }
.tut-head { display: grid; gap: 4px; }
.tut-head h1 { font-size: clamp(1.5rem, 6vw, 2rem); }
.tut-video { display: grid; gap: 8px; }
.video-frame { position: relative; aspect-ratio: 16 / 9; border-radius: var(--r-card); overflow: hidden; background: var(--night); }
.video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.tut-play { position: absolute; inset: 0; padding: 0; border: 0; background: none; cursor: pointer; }
.tut-play img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tut-play-btn { position: absolute; inset: 0; display: grid; place-items: center; }
.tut-play-btn .ic { width: 72px; height: 72px; padding: 20px; border-radius: 50%; background: color-mix(in srgb, var(--night) 72%, transparent); color: var(--on-night); transition: transform var(--dur-press) var(--ease-out); }
.tut-play:active .tut-play-btn .ic { transform: scale(0.94); }
.tut-controls { display: flex; gap: 8px; flex-wrap: wrap; }
.tut-steps, .tut-practice { display: grid; gap: 12px; }
/* Stepper: icons on a line, the current one large, done ones filled. */
.stepper { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); position: relative; }
.stepper::before { content: ""; position: absolute; left: 10%; right: 10%; top: 50%; height: 2px; background: var(--line); }
.stepper li { display: grid; place-items: center; position: relative; }
.stepper button { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--line-strong); background: var(--surface); color: var(--ink-3); cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out); }
.stepper button .ic { width: 18px; height: 18px; }
.stepper li.done button { background: var(--pine-soft); border-color: var(--pine); color: var(--pine); }
.stepper li.on button { width: 48px; height: 48px; background: var(--pine); border-color: var(--pine); color: var(--surface); box-shadow: 0 0 0 5px var(--pine-soft); }
/* The chapter card: a coloured band with a big icon and title, then the content. */
.tut-card { border-radius: var(--r-sheet); overflow: hidden; background: var(--pine); color: var(--surface); box-shadow: var(--shadow-float); animation: tut-in var(--dur) var(--ease-out); touch-action: pan-y; }
.tut-band { display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "badge kicker read" "badge title read"; column-gap: 12px; align-items: center; padding: 14px 16px 4px; }
.tut-band h2 { grid-area: title; font-size: 1.25rem; line-height: 1.2; color: var(--surface); }
.tut-kicker { grid-area: kicker; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: color-mix(in srgb, var(--surface) 75%, transparent); }
.tut-badge { grid-area: badge; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: var(--surface); color: var(--pine); }
.tut-badge .ic { width: 22px; height: 22px; }
.tut-body { display: grid; gap: 12px; padding: 16px; font-size: 1rem; line-height: 1.5; }
.tut-lead { margin: 0; padding: 14px; border-radius: 14px; background: var(--surface); color: var(--ink); font-size: 1.0625rem; font-weight: 600; }
.checklist, .pairs, .stops { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.checklist label { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 14px; background: var(--surface); color: var(--ink); cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out); }
.checklist input { position: absolute; opacity: 0; pointer-events: none; }
.checklist .box { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 8px; border: 2px solid var(--line-strong); background: var(--surface); color: transparent; }
.checklist .ticked { background: var(--pine-soft); }
.checklist .ticked .box { background: var(--pine); border-color: var(--pine); color: var(--surface); }
.checklist input:focus-visible + .box { outline: 3px solid var(--focus, var(--pine)); outline-offset: 2px; }
.timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.timeline li { display: flex; gap: 14px; align-items: flex-start; position: relative; padding-bottom: 16px; }
.timeline li:not(:last-child)::before { content: ""; position: absolute; left: 13px; top: 30px; bottom: 2px; width: 2px; background: color-mix(in srgb, var(--surface) 40%, transparent); }
.timeline .dot { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 50%; background: var(--surface); color: var(--pine); font-weight: 700; font-size: 0.875rem; }
.rhythm { display: grid; gap: 8px; padding: 14px; border-radius: 14px; background: var(--surface); color: var(--ink); }
.rhythm-label { font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-2); }
.rhythm-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.beat { padding: 8px 14px; border-radius: var(--r-pill); background: var(--sunken); font-weight: 700; text-transform: capitalize; }
.beat.hold { background: var(--pine-soft); color: var(--pine); }
.beat small { font-weight: 600; text-transform: none; }
.beat-arrow { width: 18px; height: 18px; color: var(--ink-3); }
.pairs li { display: grid; border-radius: 14px; overflow: hidden; background: var(--surface); color: var(--ink); }
.pairs p { margin: 0; display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; }
.pairs .ic { flex: none; margin-top: 4px; width: 20px; height: 20px; }
.avoid { background: var(--sunken); color: var(--ink-2); text-decoration: line-through; text-decoration-thickness: 1px; }
.avoid .ic { color: var(--danger-ink); }
.instead { background: var(--surface); font-weight: 600; }
.instead .ic { color: var(--pine); }
.stops li { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 14px; background: var(--surface); color: var(--ink); font-weight: 600; }
.stops .ic { flex: none; margin-top: 3px; color: var(--danger-ink); }
.stop-call { background: var(--danger-ink); color: var(--surface); border-color: var(--danger-ink); display: flex; gap: 8px; justify-content: center; align-items: center; text-decoration: none; }
.tut-nav { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 8px; }
.tut-nav .big-btn { display: flex; gap: 6px; align-items: center; justify-content: center; text-decoration: none; }
.tut-title { display: flex; gap: 8px; align-items: center; font-size: 1.25rem; }
@keyframes tut-in { from { opacity: 0; transform: translateY(6px); } }
/* Practice: the video to copy next to the camera that checks (stacked upright, side by side on its side). */
.tut-split { display: grid; gap: 8px; }
.tut-split .demo { aspect-ratio: 16 / 9; height: auto; }
@media (orientation: landscape) {
  .tut-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
}
.tut-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.tut-cam { position: relative; border-radius: var(--r-card); overflow: hidden; }
.tut-cam :deep(.camera) { aspect-ratio: 3 / 4; border-radius: 0; }
.tut-score { position: absolute; left: 10px; right: 10px; bottom: 10px; display: grid; gap: 2px; padding: 10px 14px; border-radius: 14px; color: var(--on-night); }
.tut-count { font: 700 2.25rem/1 var(--display); }
.tut-result { margin: 0; font-size: 1.0625rem; }
.lab-table-wrap { overflow-x: auto; }
.lab-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; font-variant-numeric: tabular-nums; }
.lab-table th, .lab-table td { padding: 6px 4px; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; }
.lab-table th:first-child, .lab-table td:first-child { text-align: left; }
.tut-go { margin-top: 8px; text-decoration: none; display: flex; justify-content: center; gap: 8px; align-items: center; }
</style>
