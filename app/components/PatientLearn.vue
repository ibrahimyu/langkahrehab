<script setup lang="ts">
import { ArrowLeft, ChevronRight, Phone, Square, Volume2 } from "lucide-vue-next";
import { cardText, recoveryCard, recoveryCards } from "#shared/recovery";
import { computeJourneyStage } from "#shared/journey";
import type { Patient } from "#shared/model";

// "Understand my recovery" (PAS-16): a list of short cards, and one card per page with read aloud.
// The text is fixed content from clinical sources (shared/recovery.ts), never generated.
const props = defineProps<{ patientId: string; topic?: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();
const reader = useReadAloud();

// The patient's step only orders the list; the cards work without it.
const step = ref<number | null>(null);
onMounted(async () => {
  try {
    step.value = computeJourneyStage((await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient);
  } catch {
    step.value = null;
  }
});

const base = computed(() => `/patient/${props.patientId}/learn`);
const card = computed(() => (props.topic ? recoveryCard(props.topic) : undefined));
const forStep = computed(() => (step.value ? recoveryCards.filter((c) => c.steps.includes(step.value!) && c.steps.length < 5) : []));
const others = computed(() => recoveryCards.filter((c) => c !== card.value && !forStep.value.includes(c)));
const more = computed(() => recoveryCards.filter((c) => c !== card.value));
</script>

<template>
  <!-- One card -->
  <section v-if="topic" class="learn">
    <NuxtLink :to="base" class="link with-ic back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("learnTitle") }}</NuxtLink>
    <article v-if="card" class="card topic">
      <header class="topic-head">
        <span class="topic-ic big"><component :is="recoveryIcons[card.id]" class="ic" aria-hidden="true" /></span>
        <div class="topic-titles">
          <h1>{{ card.title[lang] }}</h1>
          <p class="hint">{{ card.lede[lang] }}</p>
        </div>
      </header>
      <button v-if="reader.supported.value" class="ghost small-btn read" :aria-pressed="reader.speaking.value" @click="reader.toggle(cardText(card, lang, T('whenToCall')))">
        <component :is="reader.speaking.value ? Square : Volume2" class="ic" aria-hidden="true" /> {{ reader.speaking.value ? T("stopReading") : T("readAloud") }}
      </button>
      <ul class="points">
        <li v-for="(p, i) in card.points" :key="i">{{ p[lang] }}</li>
      </ul>
      <div class="call">
        <b class="with-ic"><Phone class="ic" aria-hidden="true" /> {{ T("whenToCall") }}</b>
        <p>{{ card.call[lang] }}</p>
      </div>
      <p class="source">{{ T("sourceLabel") }}: {{ card.source }}</p>
    </article>
    <p v-else class="card hint">{{ T("cardMissing") }}</p>

    <h2 class="list-head">{{ T("moreTopics") }}</h2>
    <ul class="topic-list">
      <li v-for="c in more" :key="c.id">
        <NuxtLink :to="`${base}/${c.id}`" class="topic-row">
          <span class="topic-ic"><component :is="recoveryIcons[c.id]" class="ic" aria-hidden="true" /></span>
          <span class="row-text"><b>{{ c.title[lang] }}</b></span>
          <ChevronRight class="ic chev" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </section>

  <!-- All topics -->
  <section v-else class="learn">
    <header class="page-q">
      <h1>{{ T("learnTitle") }}</h1>
    </header>
    <template v-if="forStep.length">
      <h2 class="list-head">{{ T("forYourStep") }}</h2>
      <ul class="topic-list">
        <li v-for="c in forStep" :key="c.id">
          <NuxtLink :to="`${base}/${c.id}`" class="topic-row feature">
            <span class="topic-ic"><component :is="recoveryIcons[c.id]" class="ic" aria-hidden="true" /></span>
            <span class="row-text"><b>{{ c.title[lang] }}</b><span class="hint">{{ c.lede[lang] }}</span></span>
            <ChevronRight class="ic chev" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <h2 class="list-head">{{ T("moreTopics") }}</h2>
    </template>
    <ul class="topic-list">
      <li v-for="c in others" :key="c.id">
        <NuxtLink :to="`${base}/${c.id}`" class="topic-row">
          <span class="topic-ic"><component :is="recoveryIcons[c.id]" class="ic" aria-hidden="true" /></span>
          <span class="row-text"><b>{{ c.title[lang] }}</b><span class="hint">{{ c.lede[lang] }}</span></span>
          <ChevronRight class="ic chev" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.learn { display: grid; gap: 14px; }
.page-q { display: grid; gap: 6px; padding-top: 4px; }
.page-q h1 { font-size: clamp(1.5rem, 6vw, 1.875rem); }
.back { justify-self: start; }
.list-head { font-size: 1.0625rem; margin-top: 6px; }
.topic-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.topic-row { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 12px 14px; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-sm); color: inherit; text-decoration: none; transition: transform var(--dur-press) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
.topic-row:active { transform: scale(0.985); }
@media (hover: hover) { .topic-row:hover { box-shadow: var(--shadow-md); } }
.topic-row.feature .topic-ic { background: var(--dawn-soft); color: var(--dawn-ink); }
.row-text { display: grid; gap: 2px; flex: 1; min-width: 0; }
.chev { flex: none; color: var(--ink-3); }
.topic-ic { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 14px; background: var(--pine-soft); color: var(--pine); }
.topic-ic.big { width: 56px; height: 56px; border-radius: 16px; }
.topic-ic.big .ic { width: 26px; height: 26px; }
.topic { display: grid; gap: 14px; }
.topic-head { display: flex; gap: 14px; align-items: center; }
.topic-titles { display: grid; gap: 4px; min-width: 0; }
.topic-titles h1 { font-size: 1.5rem; }
.read { justify-self: start; }
.points { margin: 0; padding-left: 20px; display: grid; gap: 10px; font-size: 1.0625rem; line-height: 1.5; }
.call { display: grid; gap: 6px; padding: 14px; border-radius: 14px; background: var(--dawn-soft); }
.call b { color: var(--dawn-ink); }
.source { font-size: 0.8125rem; color: var(--ink-3); }
</style>
