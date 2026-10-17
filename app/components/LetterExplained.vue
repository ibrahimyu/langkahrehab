<script setup lang="ts">
import { CalendarCheck, House, Info, Pill, ShieldAlert, Stethoscope } from "lucide-vue-next";
import type { Patient } from "#shared/model";

// The discharge letter in everyday words, after the doctor checked it. Patient and family read the same.
const props = defineProps<{ explanation: NonNullable<Patient["letterExplanation"]>; family?: boolean }>();
const T = useT();
const spoken = computed(() =>
  [props.explanation.what, ...props.explanation.homeCare, ...props.explanation.warningSigns, ...props.explanation.visits, T("letMeds")].join(" "),
);
</script>

<template>
  <article class="letter">
    <header class="letter-head">
      <h1>{{ family ? T("letTitleFam") : T("letTitle") }}</h1>
      <p class="hint with-ic"><Stethoscope class="ic" aria-hidden="true" /> {{ T("letChecked", { hospital: explanation.hospital ?? "" }) }}</p>
      <UiReadAloud :text="spoken" />
    </header>

    <section v-if="explanation.what" class="letter-card">
      <h2><Info class="ic" aria-hidden="true" /> {{ T("letWhat") }}</h2>
      <p>{{ explanation.what }}</p>
    </section>
    <section v-if="explanation.homeCare.length" class="letter-card">
      <h2><House class="ic" aria-hidden="true" /> {{ T("letHome") }}</h2>
      <ul><li v-for="(x, i) in explanation.homeCare" :key="i">{{ x }}</li></ul>
    </section>
    <section v-if="explanation.warningSigns.length" class="letter-card warn">
      <h2><ShieldAlert class="ic" aria-hidden="true" /> {{ T("letWarn") }}</h2>
      <ul><li v-for="(x, i) in explanation.warningSigns" :key="i">{{ x }}</li></ul>
    </section>
    <section v-if="explanation.visits.length" class="letter-card">
      <h2><CalendarCheck class="ic" aria-hidden="true" /> {{ T("letVisits") }}</h2>
      <ul><li v-for="(x, i) in explanation.visits" :key="i">{{ x }}</li></ul>
    </section>
    <p class="letter-meds with-ic"><Pill class="ic" aria-hidden="true" /> {{ T("letMeds") }}</p>
  </article>
</template>

<style scoped>
.letter { display: grid; gap: 12px; }
.letter-head { display: grid; gap: 6px; justify-items: start; }
.letter-head h1 { font-size: clamp(1.375rem, 6vw, 1.75rem); }
.letter-card { display: grid; gap: 8px; padding: 16px; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-sm); }
.letter-card h2 { display: flex; gap: 8px; align-items: center; font-size: 1.0625rem; }
.letter-card h2 .ic { color: var(--pine); }
.letter-card p { margin: 0; line-height: 1.55; }
.letter-card ul { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; line-height: 1.5; }
.letter-card.warn { background: var(--danger-soft); }
.letter-card.warn h2 .ic { color: var(--danger-ink); }
.letter-meds { margin: 0; padding: 12px; border-radius: 12px; background: var(--sunken); }
</style>
