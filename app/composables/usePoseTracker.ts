import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { RepCounter, missing as missingLandmarks, type Landmark, type RepEvent, type Tracking } from "#shared/pose";

// Pinned to the installed package version so the WebAssembly files match the JavaScript.
const MEDIAPIPE_VERSION = "1.0.1";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const POSE_MODELS = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
} as const;
export type PoseModel = keyof typeof POSE_MODELS;

const HISTORY_MS = 10_000;
const SMOOTHING = 0.4;

export type TrackerState = "idle" | "loading" | "running" | "error";

/**
 * Camera + MediaPipe pose landmarks in the browser. Frames never leave the device.
 * Computes the exercise's movement signal each frame and counts reps while `counting` is on.
 */
export function usePoseTracker(els: {
  video: Ref<HTMLVideoElement | null>;
  overlay: Ref<HTMLCanvasElement | null>;
  chart: Ref<HTMLCanvasElement | null>;
  onRep?: (e: RepEvent) => void;
}) {
  const state = ref<TrackerState>("idle");
  const error = ref("");
  const value = ref<number | null>(null);
  const missing = ref<string[]>([]);
  const person = ref(false);
  const count = ref(0);
  const atTop = ref(false);
  const fps = ref(0);
  const counting = ref(false);

  let landmarker: PoseLandmarker | undefined;
  let connections: { start: number; end: number }[] = [];
  let stream: MediaStream | undefined;
  let frame = 0;
  let lastVideoTime = -1;
  let tracking: Tracking | null = null;
  let counter = new RepCounter(1, 0, 0);
  let smooth: number | null = null;
  let history: { t: number; v: number }[] = [];
  let frames: number[] = [];

  function configure(t: Tracking | null, holdMs: number) {
    tracking = t;
    counter = new RepCounter(t?.up ?? 1, t?.down ?? 0, holdMs);
    smooth = null;
    history = [];
    count.value = 0;
    atTop.value = false;
  }

  function setThresholds(up: number, down: number) {
    counter.up = up;
    counter.down = down;
    if (tracking) tracking = { ...tracking, up, down };
  }

  function reset() {
    counter.reset();
    count.value = 0;
    atTop.value = false;
  }

  function draw(lm: Landmark[] | undefined) {
    const canvas = els.overlay.value;
    const video = els.video.value;
    if (!canvas || !video) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm) return;
    const W = canvas.width;
    const H = canvas.height;
    const used = new Set((tracking?.uses ?? []).map(([side, joint]) => `${side}:${joint}`));
    const usedIdx = new Set<number>();
    const idx = { left: { shoulder: 11, hip: 23, knee: 25, ankle: 27 }, right: { shoulder: 12, hip: 24, knee: 26, ankle: 28 } };
    for (const side of ["left", "right"] as const)
      for (const [joint, i] of Object.entries(idx[side])) if (used.has(`${side}:${joint}`)) usedIdx.add(i);

    ctx.lineWidth = Math.max(2, W / 320);
    for (const { start, end } of connections) {
      const a = lm[start]!;
      const b = lm[end]!;
      const seen = Math.min(a.visibility ?? 0, b.visibility ?? 0) >= 0.5;
      ctx.strokeStyle = usedIdx.has(start) && usedIdx.has(end) ? "#FFC845" : seen ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    }
    lm.forEach((p, i) => {
      if (i < 11) return; // skip face points
      const seen = (p.visibility ?? 0) >= 0.5;
      ctx.fillStyle = usedIdx.has(i) ? (seen ? "#FFC845" : "#B3261E") : seen ? "#FFFFFF" : "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, usedIdx.has(i) ? W / 110 : W / 200, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawChart(now: number) {
    const canvas = els.chart.value;
    if (!canvas || !tracking) return;
    const ctx = canvas.getContext("2d")!;
    const W = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const H = (canvas.height = canvas.clientHeight * devicePixelRatio);
    const [lo, hi] = tracking.range;
    const y = (v: number) => H - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = devicePixelRatio;
    for (const [v, color] of [[counter.up, "#1E7A3D"], [counter.down, "#1F5F8B"]] as const) {
      ctx.strokeStyle = color;
      ctx.setLineDash([6 * devicePixelRatio, 4 * devicePixelRatio]);
      ctx.beginPath();
      ctx.moveTo(0, y(v));
      ctx.lineTo(W, y(v));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = "#16324F";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    history.forEach((p, i) => {
      const x = W - ((now - p.t) / HISTORY_MS) * W;
      if (i === 0) ctx.moveTo(x, y(p.v));
      else ctx.lineTo(x, y(p.v));
    });
    ctx.stroke();
  }

  function onResult(lm: Landmark[] | undefined, now: number) {
    person.value = !!lm;
    draw(lm);
    if (!lm || !tracking) {
      value.value = null;
      return;
    }
    missing.value = missingLandmarks(tracking, lm);
    if (missing.value.length) {
      value.value = null;
      return;
    }
    const raw = tracking.compute(lm);
    smooth = smooth === null ? raw : smooth * (1 - SMOOTHING) + raw * SMOOTHING;
    value.value = Math.round(smooth);
    history.push({ t: now, v: smooth });
    while (history.length && now - history[0]!.t > HISTORY_MS) history.shift();
    if (counting.value) {
      const e = counter.push(smooth, now);
      atTop.value = counter.atTop;
      if (e) {
        count.value = e.count;
        els.onRep?.(e);
      }
    }
  }

  function loop() {
    frame = requestAnimationFrame(loop);
    const video = els.video.value;
    if (!landmarker || !video || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    const now = performance.now();
    landmarker.detectForVideo(video, now, (result) => onResult(result.landmarks[0], now));
    drawChart(now);
    frames.push(now);
    while (frames.length && now - frames[0]! > 1000) frames.shift();
    fps.value = frames.length;
  }

  async function start(model: PoseModel) {
    if (state.value === "loading" || state.value === "running") return;
    state.value = "loading";
    error.value = "";
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      const video = els.video.value!;
      video.srcObject = stream;
      await video.play();
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: POSE_MODELS[model], delegate },
        runningMode: "VIDEO" as const,
        numPoses: 1,
      });
      landmarker = await PoseLandmarker.createFromOptions(fileset, options("GPU")).catch(() =>
        PoseLandmarker.createFromOptions(fileset, options("CPU")),
      );
      connections = PoseLandmarker.POSE_CONNECTIONS;
      state.value = "running";
      loop();
    } catch (e: any) {
      stop();
      error.value = e?.name === "NotAllowedError" ? "Camera permission was denied." : e?.message || "Could not start the camera.";
      state.value = "error";
    }
  }

  function stop() {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
    landmarker?.close();
    landmarker = undefined;
    if (els.video.value) els.video.value.srcObject = null;
    draw(undefined);
    value.value = null;
    person.value = false;
    state.value = "idle";
  }

  onBeforeUnmount(stop);

  return { state, error, value, missing, person, count, atTop, fps, counting, start, stop, configure, setThresholds, reset };
}
