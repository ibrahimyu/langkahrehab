<script setup lang="ts">
import { ArrowLeft, ArrowRight, Camera, ExternalLink, Gauge, Play, RotateCcw } from "lucide-vue-next";
import { exerciseById } from "#shared/exercises";
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
const last = computed(() => reps.value.at(-1) ?? null);
const avg = computed(() => average(reps.value.map((r) => r.score)));
async function startPractice() {
  reps.value = [];
  events.value = [];
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
}
</script>

<template>
  <div class="app-col tutor">
    <NuxtLink :to="`/patient/${patientId}`" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("home") }}</NuxtLink>
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

      <section class="card tut-steps" aria-live="polite">
        <div class="tut-chapters" role="tablist">
          <button v-for="(c, i) in CHAPTERS" :key="c" role="tab" :aria-selected="step === i" class="tut-chip" :class="{ on: step === i, done: i < step }" @click="step = i">{{ i + 1 }}. {{ T(chapterTitle[c]) }}</button>
        </div>
        <template v-if="current">
          <p class="hint">{{ T("tutStepOf", { n: step + 1, m: steps.length }) }}</p>
          <div class="tut-row">
            <h2 class="tut-title">{{ T(chapterTitle[current.chapter]) }}</h2>
            <UiReadAloud :text="readText" />
          </div>
          <ul class="tut-lines" :class="{ warn: current.chapter === 'stop' }">
            <li v-for="(l, i) in current.lines" :key="i">{{ l }}</li>
          </ul>
          <div class="tut-nav">
            <span class="grow" />
            <button class="ghost small-btn" :disabled="step === 0" @click="step--"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("back") }}</button>
            <button class="primary small-btn" :disabled="step === steps.length - 1" @click="step++">{{ T("tutNext") }} <ArrowRight class="ic" aria-hidden="true" /></button>
          </div>
        </template>
      </section>

      <section class="card tut-practice">
        <h2 class="tut-title"><Camera class="ic" aria-hidden="true" /> {{ T("tutPractice") }}</h2>
        <template v-if="trackable">
          <p class="hint">{{ T("tutPracticeHint") }}</p>
          <p class="hint">{{ T(`camPlace_${exerciseId}` as TextKey) }}</p>
          <div v-if="practising" class="tut-cam">
            <PoseTracker ref="tracker" :exercise-id="exerciseId" :limb="limbOf(patient.profile)" :hold-seconds="exercise.holdSeconds" :counting="true" model="full" :analysis="analysis" @rep="onRep" />
            <div class="tut-score glass">
              <b class="tut-count">{{ reps.length }}</b>
              <span v-if="last">{{ T("formRep", { n: reps.length }) }} · <b>{{ last.score }}</b></span>
              <span v-if="last?.weakest">{{ T(`formTip_${last.weakest}` as TextKey) }}</span>
              <span v-else-if="last">{{ T(`formBand_${formBand(last.score)}` as TextKey) }}</span>
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
.tut-steps, .tut-practice { display: grid; gap: 10px; }
.tut-chapters { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 0 4px 2px; }
.tut-chip { flex: none; min-height: 40px; padding: 6px 12px; border-radius: var(--r-pill); border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font-weight: 600; font-size: 0.875rem; cursor: pointer; }
.tut-chip.done { color: var(--pine); border-color: var(--pine-soft); }
.tut-chip.on { background: var(--ink); color: var(--surface); border-color: var(--ink); }
.tut-title { display: flex; gap: 8px; align-items: center; font-size: 1.25rem; }
.tut-lines { margin: 0; padding-left: 1.2em; display: grid; gap: 8px; font-size: 1.0625rem; }
.tut-lines.warn li::marker { color: var(--danger-ink); }
.tut-nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.grow { flex: 1; }
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
.tut-go { position: sticky; bottom: 12px; text-decoration: none; display: flex; justify-content: center; gap: 8px; align-items: center; }
</style>
