<script setup lang="ts">
import type { Component } from "vue";
import { BookOpen, Check, ChevronRight, ClipboardCheck, Dumbbell, Bandage, Flag, MessageCircleQuestion, PersonStanding, Square, Target, TrendingUp, Volume2 } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";
import type { Patient } from "#shared/model";
import { JOURNEY_STEPS, computeJourneyStage, nextStepKey, repsProgress } from "#shared/journey";
import { recoveryCards } from "#shared/recovery";

// "My journey" (PAS-03): the patient's goal, five steps without dates, and one next step from rules.
const props = defineProps<{ patientId: string }>();
const api = useApi("patient");
const T = useT();
const reader = useReadAloud();

const data = ref<{ patient: Patient; now: number } | null>(null);
const loadError = ref("");
async function load() {
  loadError.value = "";
  try {
    data.value = await api(`/api/patients/${props.patientId}`);
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(load);

const p = computed(() => data.value?.patient);
const step = computed(() => (p.value ? computeJourneyStage(p.value) : 1));
const goal = computed(() => p.value?.goals.find((g) => g.main)?.text ?? p.value?.memories.findLast((m) => m.kind === "goal")?.text);
const progress = computed(() => (p.value ? repsProgress(p.value.sessions, data.value!.now) : null));
const stepIcons: Component[] = [Bandage, Dumbbell, ClipboardCheck, PersonStanding, Flag];
const stepKey = (n: number) => `journeyStep${n}` as TextKey;
const learnFor = computed(() => recoveryCards.find((c) => c.steps.includes(step.value) && c.steps.length < 5) ?? recoveryCards[0]!);
const waiting = computed(() => (p.value?.notes ?? []).filter((n) => n.kind === "question" && !n.answeredAt && !n.reply).length);
const base = computed(() => `/patient/${props.patientId}`);

const readAll = () =>
  reader.toggle([T("journeyRow", { n: step.value }), T(stepKey(step.value)), `${T("journeyNextTitle")}: ${T(nextStepKey(step.value))}`, progress.value ? T("journeyProgress", progress.value) : ""].filter(Boolean).join(". "));
</script>

<template>
  <section class="journey">
    <header class="page-q">
      <h1>{{ T("journeyTitle") }}</h1>
    </header>

    <div v-if="loadError" class="card stack">
      <p class="error">{{ loadError }}</p>
      <button class="ghost small-btn" @click="load">{{ T("tryAgain") }}</button>
    </div>
    <div v-else-if="!p" class="skeleton-block" aria-hidden="true" />

    <template v-else>
      <!-- The patient's own goal is what the path leads to. -->
      <NuxtLink :to="`${base}/goals`" class="goal-card">
        <span class="tile-label on-night-2">{{ T("goal") }}</span>
        <b v-if="goal" class="with-ic goal-text"><Target class="ic" aria-hidden="true" /> {{ goal }}</b>
        <span v-else class="on-night-2">{{ T("journeyNoGoal") }}</span>
      </NuxtLink>

      <!-- Five steps, no dates. -->
      <ol class="path">
        <li v-for="n in JOURNEY_STEPS" :key="n" class="path-step" :class="{ done: n < step, now: n === step }" :aria-current="n === step ? 'step' : undefined">
          <span class="dot"><component :is="n < step ? Check : stepIcons[n - 1]" class="ic" aria-hidden="true" /></span>
          <span class="step-text">
            <b>{{ T(stepKey(n)) }}</b>
            <span v-if="n === step" class="pill here">{{ T("journeyHere") }}</span>
          </span>
        </li>
      </ol>

      <article class="card next">
        <div class="next-top">
          <span class="tile-label">{{ T("journeyNextTitle") }}</span>
          <button v-if="reader.supported.value" class="ghost small-btn" :aria-pressed="reader.speaking.value" @click="readAll">
            <component :is="reader.speaking.value ? Square : Volume2" class="ic" aria-hidden="true" /> {{ reader.speaking.value ? T("stopReading") : T("readAloud") }}
          </button>
        </div>
        <p class="next-text">{{ T(nextStepKey(step)) }}</p>
        <p v-if="progress" class="progress-line with-ic"><TrendingUp class="ic" aria-hidden="true" /> {{ T("journeyProgress", progress) }}</p>
      </article>

      <ul class="links">
        <li>
          <NuxtLink :to="`${base}/learn/${learnFor.id}`" class="link-row">
            <span class="row-ic"><BookOpen class="ic" aria-hidden="true" /></span>
            <b class="row-text">{{ T("journeyLearn") }}</b>
            <ChevronRight class="ic chev" aria-hidden="true" />
          </NuxtLink>
        </li>
        <li>
          <NuxtLink :to="`${base}/questions`" class="link-row">
            <span class="row-ic"><MessageCircleQuestion class="ic" aria-hidden="true" /></span>
            <span class="row-text"><b>{{ T("questionsTitle") }}</b><span v-if="waiting" class="hint">{{ T("questionsWaitingN", { n: waiting }) }}</span></span>
            <ChevronRight class="ic chev" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.journey { display: grid; gap: 14px; }
.page-q { display: grid; gap: 6px; padding-top: 4px; }
.page-q h1 { font-size: clamp(1.5rem, 6vw, 1.875rem); }
.skeleton-block { height: 360px; border-radius: var(--r-card); background: var(--sunken); }
.goal-card { display: grid; gap: 6px; padding: 18px; border-radius: var(--r-card); background: var(--night); color: var(--on-night); box-shadow: var(--shadow-lg); text-decoration: none; transition: transform var(--dur-press) var(--ease-out); }
.goal-card:active { transform: scale(0.985); }
.goal-text { font: 700 1.25rem/1.3 var(--display); }
.goal-text .ic { color: var(--pine-light); }
.path { list-style: none; margin: 0; padding: 0; display: grid; }
.path-step { position: relative; display: flex; align-items: center; gap: 14px; padding: 8px 12px; border-radius: 16px; color: var(--ink-3); }
/* The line between the dots. */
.path-step:not(:last-child)::after { content: ""; position: absolute; left: 33px; top: 52px; bottom: -8px; width: 2px; background: var(--line); }
.path-step.done:not(:last-child)::after { background: var(--pine); }
.dot { position: relative; z-index: 1; display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 50%; background: var(--sunken); color: var(--ink-3); }
.path-step.done { color: var(--ink-2); }
.path-step.done .dot { background: var(--pine); color: var(--surface); }
.path-step.now { background: var(--dawn); color: var(--ink); margin: 6px 0; }
.path-step.now .dot { background: var(--surface); color: var(--ink); }
.step-text { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.here { background: var(--surface); color: var(--ink); }
.next { display: grid; gap: 8px; }
.next-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.next-text { font: 600 1.125rem/1.45 var(--display); }
.progress-line { color: var(--pine); font-weight: 600; }
.links { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.link-row { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 14px; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-sm); color: inherit; text-decoration: none; transition: transform var(--dur-press) var(--ease-out); }
.link-row:active { transform: scale(0.985); }
.row-ic { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 12px; background: var(--pine-soft); color: var(--pine); }
.row-text { display: grid; gap: 2px; flex: 1; min-width: 0; }
.chev { flex: none; color: var(--ink-3); }
</style>
