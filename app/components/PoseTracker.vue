<script setup lang="ts">
import { tracking, type Limb, type RepEvent } from "#shared/pose";
import type { PoseModel } from "../composables/usePoseTracker";

const props = defineProps<{
  exerciseId: string;
  limb: Limb;
  holdSeconds: number;
  /** Count reps only while this is on (e.g. during a set). */
  counting: boolean;
  model: PoseModel;
  /** Patient view: camera and status only, no tuning controls. */
  compact?: boolean;
}>();
const emit = defineEmits<{ rep: [e: RepEvent] }>();

const video = ref<HTMLVideoElement | null>(null);
const overlay = ref<HTMLCanvasElement | null>(null);
const chart = ref<HTMLCanvasElement | null>(null);
const mirror = ref(true);
const up = ref(0);
const down = ref(0);

const t = computed(() => tracking(props.exerciseId, props.limb));
const tracker = usePoseTracker({ video, overlay, chart, onRep: (e) => emit("rep", e) });

watch(
  [t, () => props.holdSeconds],
  () => {
    tracker.configure(t.value, props.holdSeconds * 1000);
    up.value = t.value?.up ?? 0;
    down.value = t.value?.down ?? 0;
  },
  { immediate: true },
);
watch([up, down], () => tracker.setThresholds(Number(up.value), Number(down.value)));
watch(() => props.counting, (on) => (tracker.counting.value = on), { immediate: true });

const status = computed(() => {
  if (tracker.state.value === "loading") return "Loading the pose model…";
  if (tracker.state.value !== "running") return "Camera off";
  if (!tracker.person.value) return "No person in view";
  if (tracker.missing.value.length) return `Can’t see: ${tracker.missing.value.join(", ")}`;
  return props.counting ? "Tracking and counting" : "Tracking (not counting)";
});

defineExpose({ reset: tracker.reset, count: tracker.count, state: tracker.state, start: () => tracker.start(props.model), stop: tracker.stop });
</script>

<template>
  <div class="tracker">
    <p v-if="t?.unsupported" class="alert"><b>Not trackable</b><span>{{ t.unsupported }}</span></p>
    <p v-else-if="t" class="hint">📷 {{ t.camera }}</p>

    <div class="camera" :class="{ mirror }">
      <video ref="video" playsinline muted />
      <canvas ref="overlay" />
      <div class="camera-count" :class="{ top: tracker.atTop.value }">
        <b>{{ tracker.count.value }}</b>
        <span>{{ tracker.atTop.value ? "top" : "reps" }}</span>
      </div>
      <p v-if="tracker.state.value !== 'running'" class="camera-off">{{ status }}</p>
    </div>

    <div class="bar tracker-status">
      <span class="pill" :class="{ listening: tracker.state.value === 'running' && !tracker.missing.value.length && tracker.person.value, error: tracker.missing.value.length > 0 }">{{ status }}</span>
      <span class="hint">{{ tracker.fps.value }} fps</span>
    </div>

    <template v-if="t && !compact">
      <p class="signal"><b>{{ tracker.value.value ?? "–" }}°</b> {{ t.label }}</p>
      <canvas ref="chart" class="chart" />
      <p class="hint legend"><span class="up">- - top {{ up }}°</span> <span class="down">- - start {{ down }}°</span> · last 10 seconds</p>
    </template>

    <div v-if="!compact" class="row">
      <label><span>Top threshold (°)</span><input v-model.number="up" type="number" step="1" /></label>
      <label><span>Start threshold (°)</span><input v-model.number="down" type="number" step="1" /></label>
    </div>
    <div v-if="!compact" class="controls">
      <button v-if="tracker.state.value !== 'running'" class="primary" :disabled="tracker.state.value === 'loading' || !!t?.unsupported" @click="tracker.start(model)">
        {{ tracker.state.value === "loading" ? "Starting…" : "Start camera" }}
      </button>
      <button v-else class="ghost" @click="tracker.stop()">Stop camera</button>
      <label class="check inline"><input v-model="mirror" type="checkbox" /> Mirror view</label>
    </div>
    <p v-if="tracker.error.value" class="error">{{ tracker.error.value }}</p>
  </div>
</template>
