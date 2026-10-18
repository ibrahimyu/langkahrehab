<script setup lang="ts">
import type { Component } from "vue";
import { Activity, AudioLines, Footprints, HeartHandshake, ListChecks, MessageCircleQuestion } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";

// UXA-02: the first time a patient (or their family) opens the app on this phone, three short
// cards, then Today. Seen once per role and patient per device; storage may be blocked, so every
// access is guarded.
const props = withDefaults(defineProps<{ patientId: string; role?: "patient" | "family"; name?: string }>(), { role: "patient", name: "" });
const T = useT();
const key = computed(() => (props.role === "patient" ? `langkah-welcome-${props.patientId}` : `langkah-welcome-${props.role}-${props.patientId}`));
const open = ref(false);
const step = ref(0);
const sets: Record<"patient" | "family", { icon: Component; title: TextKey; body: TextKey }[]> = {
  patient: [
    { icon: Activity, title: "welcome1Title", body: "welcome1Body" },
    { icon: AudioLines, title: "welcome2Title", body: "welcome2Body" },
    { icon: Footprints, title: "welcome3Title", body: "welcome3Body" },
  ],
  family: [
    { icon: HeartHandshake, title: "famWelcome1Title", body: "famWelcome1Body" },
    { icon: ListChecks, title: "famWelcome2Title", body: "famWelcome2Body" },
    { icon: MessageCircleQuestion, title: "famWelcome3Title", body: "famWelcome3Body" },
  ],
};
const cards = computed(() => sets[props.role]);
const last = computed(() => step.value === cards.value.length - 1);
const card = computed(() => cards.value[step.value]!);
const primaryBtn = ref<HTMLButtonElement | null>(null);

onMounted(() => {
  try {
    open.value = !localStorage.getItem(key.value);
  } catch {
    open.value = false;
  }
  if (open.value) nextTick(() => primaryBtn.value?.focus());
});

function close() {
  open.value = false;
  try {
    localStorage.setItem(key.value, "1");
  } catch {}
}
function next() {
  if (last.value) close();
  else step.value++;
}
</script>

<template>
  <Transition name="welcome">
    <div v-if="open" class="welcome" role="dialog" aria-modal="true" :aria-labelledby="`welcome-title-${step}`" @keydown.esc="close">
      <div class="welcome-top">
        <span class="welcome-dots" role="img" :aria-label="T('welcomeStep', { n: step + 1, m: cards.length })">
          <i v-for="(_, i) in cards" :key="i" :class="{ on: i === step, done: i < step }" />
        </span>
        <button v-if="!last" class="ghost welcome-skip" @click="close">{{ T("welcomeSkip") }}</button>
      </div>
      <Transition name="welcome-card" mode="out-in">
        <div :key="step" class="welcome-card">
          <span class="welcome-art" aria-hidden="true"><component :is="card.icon" /></span>
          <h2 :id="`welcome-title-${step}`">{{ T(card.title, { name }) }}</h2>
          <p>{{ T(card.body) }}</p>
        </div>
      </Transition>
      <button ref="primaryBtn" class="primary big-btn pill-btn welcome-go" @click="next">{{ last ? T("welcomeStart") : T("welcomeNext") }}</button>
    </div>
  </Transition>
</template>

<style scoped>
.welcome {
  position: fixed; inset: 0; z-index: 80; display: grid; grid-template-rows: auto 1fr auto; gap: 16px;
  padding: max(16px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
  background: var(--surface); color: var(--ink);
}
.welcome > * { width: 100%; max-width: 480px; justify-self: center; }
.welcome-top { display: flex; justify-content: space-between; align-items: center; min-height: 48px; }
.welcome-dots { display: inline-flex; gap: 8px; }
.welcome-dots i { width: 10px; height: 10px; border-radius: var(--r-pill); background: var(--line-strong); transition: width var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out); }
.welcome-dots i.done { background: var(--pine-light); }
.welcome-dots i.on { width: 28px; background: var(--pine); }
.welcome-skip { min-height: 48px; padding: 8px 18px; }
.welcome-card { display: grid; align-content: center; justify-items: center; gap: 14px; text-align: center; }
.welcome-art { display: grid; place-items: center; width: 132px; height: 132px; margin-bottom: 8px; border-radius: 50%; background: var(--pine-soft); color: var(--pine); }
.welcome-art svg { width: 60px; height: 60px; }
.welcome-card h2 { margin: 0; font: 700 1.75rem/1.2 var(--display); max-width: 18ch; text-wrap: balance; }
.welcome-card p { margin: 0; font-size: 1.125rem; line-height: 1.5; color: var(--ink-2); max-width: 30ch; }
.welcome-go { min-height: 58px; }
.welcome-enter-active { transition: opacity var(--dur) var(--ease-out); }
.welcome-leave-active { transition: opacity 160ms var(--ease-out); }
.welcome-enter-from, .welcome-leave-to { opacity: 0; }
.welcome-card-enter-active { transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
.welcome-card-leave-active { transition: opacity 140ms var(--ease-out), transform 140ms var(--ease-out); }
.welcome-card-enter-from { opacity: 0; transform: translateX(24px); }
.welcome-card-leave-to { opacity: 0; transform: translateX(-16px); }
</style>
