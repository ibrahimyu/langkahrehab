import type { Settings } from "#shared/settings";
import { EnergyVad, rms } from "#shared/vad";
import { isEcho } from "#shared/echo";
import { Outbox, type Build } from "#shared/outbox";

type Wire = Record<string, any>;
export type LiveState = "idle" | "connecting" | "listening" | "speaking" | "ended" | "error";
export type Line = { role: "patient" | "coach" | "app"; text: string };
export type LogEntry = { t: number; kind: string; detail?: string };

const endpoint =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

/** Chunks of microphone audio kept before detected speech, so its start is not cut off (8 × 40 ms). */
const PREROLL_CHUNKS = 8;
/** While the coach is talking, speech must be this much louder to count (echo that leaks through). */
const DUCK_SCALE = 4;
/** Speech must last this many 40 ms chunks to count: about 0.24 s normally, 0.6 s to interrupt the coach. */
const START_CHUNKS = 6;
const BARGE_IN_CHUNKS = 15;
/** The phone's own speaker still echoes for a moment after the coach stops. */
const ECHO_TAIL_MS = 500;
/** Hangover for the metrics-only detector in auto turn mode. */
const METRICS_HANGOVER_MS = 300;
/** A queued app message goes out this long after the coach's voice stops, so turns do not run together. */
const QUEUE_GAP_MS = 250;
/** If Gemini never answers a turn, the queue does not wait for ever. */
const REPLY_TIMEOUT_MS = 8000;
/** What the patient said in this window can back a pain number the coach records. */
const HEARD_WINDOW_MS = 30_000;

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

/**
 * Voice coach over a direct Gemini Live socket. The server only mints the token.
 * Records timings so different turn-taking settings can be compared.
 */
export type LiveGrant = { token: string; expiresAt: string; setup: Wire };

export function useLiveCoach(handlers: {
  /** Asks the server for a one-use Live token for this session. */
  fetchGrant: (s: Settings) => Promise<LiveGrant>;
  onTool: (name: string, args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Patient speech transcription, as it streams in. */
  onInput?: (text: string) => void;
  onTurnStart?: () => void;
  /** A coach turn ended; `tools` are the tools called during it. */
  onTurnEnd?: (tools: string[]) => void;
}) {
  const state = ref<LiveState>("idle");
  const error = ref("");
  const lines = ref<Line[]>([]);
  const caption = ref("");
  const micLevel = ref(0);
  const userSpeaking = ref(false);
  const micOn = ref(true);
  const log = ref<LogEntry[]>([]);
  const replyGaps = ref<number[]>([]);
  const interruptions = ref(0);

  let settings: Settings | undefined;
  let socket: WebSocket | undefined;
  let stream: MediaStream | undefined;
  let micContext: AudioContext | undefined;
  let micNode: AudioWorkletNode | undefined;
  let out: AudioContext | undefined;
  let sources: AudioBufferSourceNode[] = [];
  let playAt = 0;
  let lastPlaybackEnd = 0;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let input = "";
  let output = "";
  let t0 = 0;
  let vad = new EnergyVad(0.02, METRICS_HANGOVER_MS);
  let preroll: ArrayBuffer[] = [];
  let setActive = false;
  let awaitingReply = false;
  let lastSpeechEnd = 0;
  let turnOpen = false;
  let turnTools: string[] = [];
  /** A turn was sent (text, or the end of the patient's speech) and Gemini has not finished answering. */
  let replyDueAt = 0;
  const outbox = new Outbox();
  let pump: ReturnType<typeof setInterval> | undefined;
  /** The patient's own words (not the coach's echo), for checking the numbers the coach records. */
  let heard: { text: string; at: number }[] = [];
  const cancelled = new Set<string>();

  const note = (kind: string, detail?: string) => {
    log.value.push({ t: Math.round(performance.now() - t0), kind, detail });
    if (log.value.length > 800) log.value.splice(0, log.value.length - 800);
  };

  const send = (data: Wire) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
  };
  const sendAudio = (buf: ArrayBuffer) =>
    send({ realtimeInput: { audio: { data: toBase64(buf), mimeType: "audio/pcm;rate=16000" } } });

  const appTurns = () => settings?.turn.kind === "app";
  // The long in-set pause is for a patient counting aloud; with the camera counting it only holds the
  // coach back, since nothing can be said until the patient's turn ends.
  const hangover = () =>
    !appTurns() ? METRICS_HANGOVER_MS : setActive && settings!.mode === "patient" ? settings!.turn.inSetSilenceMs : settings!.turn.silenceMs;
  /** Speaker latency (Bluetooth can add a quarter of a second): the room still hears the coach this long after playback ends. */
  const outLatencyMs = () => Math.round(((out as (AudioContext & { outputLatency?: number }) | undefined)?.outputLatency || out?.baseLatency || 0) * 1000);
  const coachAudible = (now: number) => sources.length > 0 || now - lastPlaybackEnd < ECHO_TAIL_MS + outLatencyMs();
  /** The coach is talking, about to talk, or the patient is talking: an app message now would cut someone off. */
  const busy = (now = performance.now()) =>
    turnOpen || now < replyDueAt || sources.length > 0 || now - lastPlaybackEnd < QUEUE_GAP_MS + outLatencyMs() || userSpeaking.value;
  const replyDue = () => (replyDueAt = performance.now() + REPLY_TIMEOUT_MS);

  const stopPlayback = () => {
    for (const s of sources) s.stop();
    sources = [];
    playAt = 0;
  };

  const play = (b64: string) => {
    if (!out) return;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    const buffer = out.createBuffer(1, pcm.length, 24000);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i]! / 32768;
    const src = out.createBufferSource();
    src.buffer = buffer;
    src.connect(out.destination);
    playAt = Math.max(playAt, out.currentTime + 0.03);
    src.start(playAt);
    playAt += buffer.duration;
    sources.push(src);
    src.onended = () => {
      sources = sources.filter((s) => s !== src);
      if (!sources.length) lastPlaybackEnd = performance.now();
      if (!sources.length && state.value === "speaking") state.value = "listening";
    };
    state.value = "speaking";
  };

  /** The coach's last words, to recognise its own voice in the input transcript (GAP-VIDEO #3). */
  let coachRecent = "";
  const flush = () => {
    const heard = input.trim();
    if (heard && !isEcho(heard, `${coachRecent} ${output}`)) lines.value.push({ role: "patient", text: heard });
    else if (heard) note("echo-dropped", heard);
    if (output.trim()) {
      lines.value.push({ role: "coach", text: output.trim() });
      coachRecent = `${coachRecent} ${output}`.slice(-600);
    }
    input = output = "";
  };

  const openTurn = () => {
    if (turnOpen) return;
    turnOpen = true;
    turnTools = [];
    note("coach-turn-start");
    handlers.onTurnStart?.();
  };
  const closeTurn = (why: string) => {
    replyDueAt = 0;
    if (!turnOpen) return;
    turnOpen = false;
    note("coach-turn-end", why);
    handlers.onTurnEnd?.(turnTools);
  };

  const receive = (m: Wire) => {
    if (m.setupComplete) {
      state.value = "listening";
      note("setup-complete");
      say("[APP] The patient opened the session. Start now.");
    }
    const c = m.serverContent ?? {};
    if (c.interrupted) {
      interruptions.value++;
      note("interrupted");
      stopPlayback();
      flush();
      closeTurn("interrupted");
      state.value = "listening";
    }
    if (c.inputTranscription?.text) {
      input += c.inputTranscription.text;
      // Echo of the coach is not the patient: do not count it, check it for red flags or caption it.
      if (!isEcho(input, `${coachRecent} ${output}`)) {
        heard.push({ text: c.inputTranscription.text, at: Date.now() });
        handlers.onInput?.(c.inputTranscription.text);
      }
      note("heard", c.inputTranscription.text);
    }
    if (c.outputTranscription?.text) {
      openTurn();
      output += c.outputTranscription.text;
      caption.value = output;
    }
    for (const part of c.modelTurn?.parts ?? []) {
      if (!part.inlineData?.mimeType?.startsWith("audio/pcm")) continue;
      openTurn();
      if (awaitingReply && lastSpeechEnd) {
        const gap = Math.round(performance.now() - lastSpeechEnd);
        replyGaps.value.push(gap);
        note("reply-gap", `${gap} ms`);
        awaitingReply = false;
      }
      play(part.inlineData.data);
    }
    for (const call of m.toolCall?.functionCalls ?? []) {
      openTurn();
      turnTools.push(call.name);
      void answerTool(call);
    }
    if (m.toolCallCancellation) {
      for (const id of m.toolCallCancellation.ids ?? []) cancelled.add(id);
      note("tool-cancelled", JSON.stringify(m.toolCallCancellation.ids ?? []));
    }
    if (c.turnComplete) {
      flush();
      closeTurn("complete");
    }
    if (m.goAway) {
      note("go-away");
      fail("The Live session hit its time limit.");
    }
  };

  /** The app may take a moment to answer (it waits for the patient's words to arrive); Gemini waits too. */
  async function answerTool(call: Wire) {
    const args = (call.args ?? {}) as Record<string, unknown>;
    let response: Record<string, unknown>;
    try {
      response = await handlers.onTool(call.name, args);
    } catch {
      response = { ok: false, error: "The app could not apply this call." };
    }
    note("tool", `${call.name} ${JSON.stringify(args)} → ${JSON.stringify(response)}`);
    if (cancelled.delete(call.id)) return;
    send({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response }] } });
  }

  const onMicChunk = (buf: ArrayBuffer) => {
    if (state.value === "connecting" || !settings) return;
    const level = rms(new Int16Array(buf));
    micLevel.value = level;
    const now = performance.now();
    vad.hangoverMs = hangover();
    const audible = coachAudible(now);
    vad.scale = audible ? DUCK_SCALE : 1;
    vad.startChunks = audible ? BARGE_IN_CHUNKS : START_CHUNKS;
    const ev = micOn.value ? vad.push(level, now) : null;

    if (ev === "start") {
      userSpeaking.value = true;
      awaitingReply = false;
      note("patient-start");
      if (appTurns()) {
        send({ realtimeInput: { activityStart: {} } });
        for (const b of preroll) sendAudio(b);
        preroll = [];
      }
    }
    if (micOn.value && (!appTurns() || vad.speaking || ev === "end")) sendAudio(buf);
    else if (appTurns()) {
      preroll.push(buf);
      if (preroll.length > PREROLL_CHUNKS) preroll.shift();
    }
    if (ev === "end") {
      userSpeaking.value = false;
      lastSpeechEnd = vad.lastVoiceAt;
      awaitingReply = true;
      note("patient-end");
      if (appTurns()) {
        send({ realtimeInput: { activityEnd: {} } });
        replyDue();
      }
    }
  };

  function fail(message: string) {
    error.value = message;
    note("error", message);
    stop("error");
  }

  async function start(s: Settings) {
    if (state.value === "connecting" || state.value === "listening" || state.value === "speaking") return;
    settings = s;
    state.value = "connecting";
    error.value = "";
    lines.value = [];
    log.value = [];
    replyGaps.value = [];
    interruptions.value = 0;
    outbox.clear();
    heard = [];
    cancelled.clear();
    replyDueAt = 0;
    t0 = performance.now();
    vad = new EnergyVad(s.turn.threshold, METRICS_HANGOVER_MS);
    try {
      // Audio contexts must be created inside the tap that starts the session (iOS).
      out = new AudioContext();
      micContext = new AudioContext();
      await Promise.all([out.resume(), micContext.resume()]);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      await micContext.audioWorklet.addModule("/microphone-worklet.js");

      const grant = await handlers.fetchGrant(s);
      note("token");
      socket = new WebSocket(`${endpoint}?access_token=${encodeURIComponent(grant.token)}`);
      socket.onopen = () => send({ setup: grant.setup });
      socket.onmessage = async (e) => {
        try {
          receive(JSON.parse(typeof e.data === "string" ? e.data : await e.data.text()));
        } catch {
          fail("The coach sent a response the app could not read.");
        }
      };
      socket.onerror = () => fail("Connection to Gemini failed.");
      socket.onclose = (e) => {
        note("socket-closed", `${e.code} ${e.reason}`);
        if (state.value !== "ended" && state.value !== "error")
          e.code === 1000 ? stop("ended") : fail(`Connection closed (${e.code}${e.reason ? `: ${e.reason}` : ""}).`);
      };
      expiry = setTimeout(() => fail("The session time limit was reached."), Date.parse(grant.expiresAt) - Date.now());

      micNode = new AudioWorkletNode(micContext, "langkah-microphone");
      micNode.port.onmessage = (e) => onMicChunk(e.data);
      micContext.createMediaStreamSource(stream).connect(micNode);
      pump = setInterval(flushOutbox, 150);
    } catch (e: any) {
      fail(e?.statusMessage || e?.data?.statusMessage || e?.message || "Could not start the coach.");
    }
  }

  function stop(final: LiveState = "ended") {
    flush();
    closeTurn("stopped");
    clearTimeout(expiry);
    clearInterval(pump);
    outbox.clear();
    stopPlayback();
    micNode?.disconnect();
    socket?.close(1000);
    stream?.getTracks().forEach((t) => t.stop());
    void micContext?.close();
    void out?.close();
    socket = micContext = micNode = out = stream = undefined;
    micLevel.value = 0;
    userSpeaking.value = false;
    state.value = final;
  }

  const toggleMic = () => {
    micOn.value = !micOn.value;
    if (micOn.value) return;
    if (appTurns() && vad.speaking) send({ realtimeInput: { activityEnd: {} } });
    else if (!appTurns()) send({ realtimeInput: { audioStreamEnd: true } });
    vad.speaking = false;
    userSpeaking.value = false;
  };

  /** Sends a text turn to the coach (app messages start with [APP]). */
  function say(text: string) {
    const app = text.startsWith("[APP]");
    lines.value.push({ role: app ? "app" : "patient", text });
    if (!app) heard.push({ text: ` ${text} `, at: Date.now() });
    note("text", text);
    send({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } });
    replyDue();
  }

  /**
   * Sends an app message once the coach is free (see Outbox). `say` is for what must go now:
   * safety, the patient's own taps and words.
   */
  function post(key: string, build: Build) {
    outbox.post(key, build);
    flushOutbox();
  }
  function flushOutbox() {
    if (!outbox.size || socket?.readyState !== WebSocket.OPEN || state.value === "connecting" || busy()) return;
    const text = outbox.next();
    if (!text) return;
    note("queued-sent", text);
    say(text);
  }

  /** What the patient said in the last half minute (their own words, not the coach's echo). */
  function recentSpeech() {
    const since = Date.now() - HEARD_WINDOW_MS;
    heard = heard.filter((h) => h.at >= since);
    return heard.map((h) => h.text).join("");
  }
  /** Forgets the patient's words once a number from them is recorded, so one answer is not used twice. */
  const clearHeard = () => (heard = []);

  /** Adds information to the conversation without asking the coach to reply. */
  function addContext(text: string) {
    note("context", text);
    send({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: false } });
  }

  /** In app turn mode, allows longer pauses while a set is in progress. */
  const setSetActive = (active: boolean) => {
    setActive = active;
    note("set-active", String(active));
  };

  const medianReplyGap = computed(() => median(replyGaps.value));

  onBeforeUnmount(() => stop());

  return {
    state, error, lines, caption, micLevel, userSpeaking, micOn, log, replyGaps, medianReplyGap,
    interruptions, start, stop, toggleMic, say, post, addContext, setSetActive, recentSpeech, clearHeard,
  };
}
