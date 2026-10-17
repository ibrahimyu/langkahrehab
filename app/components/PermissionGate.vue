<script setup lang="ts">
import { Camera, Lock, Mic, ShieldCheck, Smartphone } from "lucide-vue-next";

// UXA-07: say why before the browser asks, and help when it was refused.
// `ask()` resolves true when the session may start (permission granted or about to be asked).
const props = withDefaults(defineProps<{ camera: boolean; mic?: boolean }>(), { mic: true });
const emit = defineEmits<{ go: []; withoutCamera: [] }>();
const T = useT();
const step = ref<"explain" | "denied" | null>(null);

async function state(name: string) {
  try {
    return (await navigator.permissions.query({ name } as PermissionDescriptor)).state;
  } catch {
    return "prompt";
  }
}
/** Called by the Start button. */
async function ask() {
  const states = await Promise.all([props.mic ? state("microphone") : Promise.resolve("granted"), props.camera ? state("camera") : Promise.resolve("granted")]);
  if (states.every((s) => s === "granted")) return emit("go");
  step.value = states.includes("denied") ? "denied" : "explain";
}
async function allow() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: props.mic, video: props.camera });
    stream.getTracks().forEach((t) => t.stop());
    step.value = null;
    emit("go");
  } catch {
    step.value = "denied";
  }
}
defineExpose({ ask });
const ios = computed(() => import.meta.client && /iphone|ipad|ipod/i.test(navigator.userAgent));
</script>

<template>
  <UiSheet :open="step === 'explain'" :title="T('permTitle')" @close="step = null">
    <div class="stack">
      <p v-if="mic" class="perm-row"><Mic class="ic" aria-hidden="true" /> {{ T("permMic") }}</p>
      <p v-if="camera" class="perm-row"><Camera class="ic" aria-hidden="true" /> {{ T("permCamera") }}</p>
      <p class="perm-row"><ShieldCheck class="ic" aria-hidden="true" /> {{ T("permPrivate") }}</p>
      <button class="primary big-btn" @click="allow">{{ camera && mic ? T("permAllowBoth") : camera ? T("permAllowCamera") : T("permAllowMic") }}</button>
    </div>
  </UiSheet>
  <UiSheet :open="step === 'denied'" :title="T('permDeniedTitle')" @close="step = null">
    <div class="stack">
      <ol class="perm-steps">
        <template v-if="ios">
          <li><Smartphone class="ic" aria-hidden="true" /> {{ T("permIos1") }}</li>
          <li><Lock class="ic" aria-hidden="true" /> {{ T("permIos2") }}</li>
        </template>
        <template v-else>
          <li><Lock class="ic" aria-hidden="true" /> {{ T("permAndroid1") }}</li>
          <li><Mic class="ic" aria-hidden="true" /> {{ T("permAndroid2") }}</li>
        </template>
        <li><ShieldCheck class="ic" aria-hidden="true" /> {{ T("permReload") }}</li>
      </ol>
      <button class="primary big-btn" @click="allow">{{ T("tryAgain") }}</button>
      <button v-if="camera && mic" class="ghost big-btn" @click="step = null; emit('withoutCamera')">{{ T("permNoCamera") }}</button>
    </div>
  </UiSheet>
</template>

<style scoped>
.perm-row { display: flex; gap: 12px; align-items: flex-start; font-size: 1.0625rem; }
.perm-row .ic { flex: none; margin-top: 3px; color: var(--pine); }
.perm-steps { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; counter-reset: s; }
.perm-steps li { display: flex; gap: 12px; align-items: flex-start; counter-increment: s; }
.perm-steps li::before { content: counter(s); display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--pine-soft); color: var(--pine); font-weight: 700; }
.perm-steps .ic { flex: none; margin-top: 4px; color: var(--ink-3); }
</style>
