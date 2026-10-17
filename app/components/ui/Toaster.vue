<script setup lang="ts">
import { CircleCheck, CircleAlert, Undo2 } from "lucide-vue-next";

const { current, dismiss } = useToast();
const T = useT();
async function undo() {
  const fn = current.value?.undo;
  dismiss();
  await fn?.();
}
</script>

<template>
  <div class="toaster" aria-live="polite">
    <Transition name="toast">
      <div v-if="current" :key="current.id" class="toast" :class="current.tone">
        <CircleAlert v-if="current.tone === 'bad'" class="ic" aria-hidden="true" />
        <CircleCheck v-else class="ic" aria-hidden="true" />
        <span class="toast-text">{{ current.text }}</span>
        <button v-if="current.undo" class="toast-undo" @click="undo"><Undo2 class="ic" aria-hidden="true" /> {{ T("undo") }}</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Sits above the patient tab bar. */
.toaster { position: fixed; left: 0; right: 0; bottom: calc(88px + env(safe-area-inset-bottom)); z-index: 60; display: grid; justify-items: center; padding: 0 16px; pointer-events: none; }
.toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; width: min(520px, 100%); min-height: 52px; padding: 10px 10px 10px 16px; border-radius: var(--r-btn-lg); background: var(--night); color: var(--on-night); box-shadow: var(--shadow-lg); font-weight: 600; }
.toast .ic { color: var(--pine-light); }
.toast.bad .ic { color: var(--on-night-danger); }
.toast-text { flex: 1; }
.toast-undo { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border: 0; border-radius: var(--r-btn); background: var(--night-raised); color: var(--on-night); font-weight: 700; cursor: pointer; }
.toast-enter-active { transition: transform var(--dur-slow) var(--ease-out), opacity var(--dur-slow) var(--ease-out); }
.toast-leave-active { transition: transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out); }
.toast-enter-from { transform: translateY(12px) scale(0.97); opacity: 0; }
.toast-leave-to { transform: translateY(6px); opacity: 0; }
</style>
