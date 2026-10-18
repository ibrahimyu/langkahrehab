<script setup lang="ts">
import { tracking, watched, type Limb, type RepEvent } from "#shared/pose";
import type { PoseModel } from "../composables/usePoseTracker";

// Camera with the pose skeleton drawn on top. Counts and scores reps while `counting` is on.
// Frames are processed on the phone and never sent anywhere.
const props = defineProps<{
  exerciseId: string;
  limb: Limb;
  holdSeconds: number;
  counting: boolean;
  model: PoseModel;
  /** Show the live angle and its last 10 seconds, for checking how the measurement behaves. */
  analysis?: boolean;
}>();
const emit = defineEmits<{ rep: [e: RepEvent]; top: [] }>();
const T = useT();

const video = ref<HTMLVideoElement | null>(null);
const overlay = ref<HTMLCanvasElement | null>(null);
const chart = ref<HTMLCanvasElement | null>(null);

// Keyed on the values, not the objects: the parent builds a new `limb` on every render, and
// reconfiguring would reset the count mid-set (and a new tracking object would re-render the parent).
const setup = computed(() => JSON.stringify([props.exerciseId, props.limb, props.holdSeconds]));
const t = computed(() => {
  const [id, limb] = JSON.parse(setup.value) as [string, Limb];
  return tracking(id, limb);
});
const tracker = usePoseTracker({ video, overlay, chart, onRep: (e) => emit("rep", e), onTop: () => emit("top") });

watch(setup, () => tracker.configure(t.value, props.holdSeconds * 1000), { immediate: true });
watch(() => props.counting, (on) => (tracker.counting.value = on), { immediate: true });

/** What the patient should fix before the camera can count; null when everything is in view. */
const framing = computed(() => {
  const s = tracker.state.value;
  if (s === "loading") return T("camLoading");
  if (s === "error") return tracker.error.value;
  if (s !== "running" || !t.value) return null;
  if (!tracker.person.value) return T("camNoPerson");
  if (tracker.missing.value.length) return T("camFraming");
  return null;
});
/** Which limb is measured, in words, so the patient knows which one to move. */
const watching = computed(() => {
  if (!t.value || t.value.unsupported) return null;
  const w = watched(t.value);
  return T(`camWatch_${w.part}`, { side: T(w.side) });
});
const ready = computed(() => tracker.state.value === "running" && !!t.value && !framing.value);

// The camera box takes the shape of the camera picture, so nothing is letterboxed or cropped.
const aspect = ref("4 / 3");
function onMeta() {
  const v = video.value;
  if (v?.videoWidth && v.videoHeight) aspect.value = `${v.videoWidth} / ${v.videoHeight}`;
}

defineExpose({ framing, live: tracker.value, goal: computed(() => t.value?.up ?? null), range: computed(() => t.value?.range ?? null), atTop: tracker.atTop, reset: tracker.reset, start: () => tracker.start(props.model), stop: tracker.stop, lastMove: tracker.lastMove, ready, trackable: computed(() => !!t.value && !t.value.unsupported) });
</script>

<template>
  <div class="tracker">
    <div class="camera mirror" :style="{ aspectRatio: aspect }">
      <video ref="video" playsinline muted @loadedmetadata="onMeta" @resize="onMeta" />
      <canvas ref="overlay" />
      <p v-if="framing" class="camera-hint" role="status">{{ framing }}</p>
      <p v-else-if="watching && tracker.state.value === 'running'" class="camera-watch">{{ watching }}</p>
      <p v-if="!framing && tracker.state.value === 'running' && t && !t.unsupported" class="camera-legend"><i aria-hidden="true" />{{ T("trkLegend") }}</p>
    </div>
    <div v-if="analysis && t" class="analysis">
      <p class="analysis-now"><b>{{ tracker.value.value ?? "–" }}°</b> <span class="hint">{{ t.label }}</span></p>
      <canvas ref="chart" class="analysis-chart" />
      <p class="hint">{{ T("labThresholds", { up: t.up, down: t.down }) }} · {{ tracker.fps.value }} fps</p>
    </div>
  </div>
</template>

<style scoped>
.camera-watch { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); margin: 0; padding: 6px 12px; border-radius: var(--r-pill); font-size: 0.875rem; font-weight: 700; white-space: nowrap; background: color-mix(in srgb, var(--dawn) 92%, transparent); color: var(--ink); }
.camera-legend { position: absolute; left: 8px; bottom: 8px; margin: 0; display: inline-flex; gap: 6px; align-items: center; padding: 4px 10px; border-radius: var(--r-pill); font-size: 0.75rem; font-weight: 600; background: color-mix(in srgb, var(--night) 72%, transparent); color: var(--on-night); }
.camera-legend i { width: 14px; height: 4px; border-radius: 2px; background: var(--track); }
.analysis { display: grid; gap: 6px; margin-top: 8px; }
.analysis-now { margin: 0; display: flex; gap: 8px; align-items: baseline; }
.analysis-now b { font: 700 1.5rem/1 var(--display); }
.analysis-chart { width: 100%; height: 110px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.camera-hint { position: absolute; left: 12px; right: 12px; top: 50%; transform: translateY(-50%); margin: 0; padding: 12px 14px; border-radius: 14px; text-align: center; font-weight: 600; background: color-mix(in srgb, var(--night) 78%, transparent); color: var(--on-night); }
</style>
