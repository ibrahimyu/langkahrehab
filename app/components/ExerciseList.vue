<script setup lang="ts">
import { ArrowLeft, ChevronRight, Clock, Play } from "lucide-vue-next";
import { exerciseById } from "#shared/exercises";
import { planMinutes } from "#shared/home";
import type { Patient } from "#shared/model";
import { thumbnailUrl, videoFor } from "#shared/videos";

// Today's exercises: every movement in the plan, each opening its how-to page, and one Start.
// The how-to pages come back here, so the patient can look at each exercise before starting.
const props = defineProps<{ patientId: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();

const patient = ref<Patient | null>(null);
const loadError = ref("");
async function load() {
  loadError.value = "";
  try {
    patient.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient;
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(load);

const items = computed(() =>
  (patient.value?.plan.items ?? []).flatMap((i) => {
    const e = exerciseById(i.exerciseId);
    if (!e) return [];
    const v = videoFor(e.id, patient.value!.profile.level);
    return [{ ...i, e, thumb: v ? thumbnailUrl(v) : null }];
  }),
);
const minutes = computed(() => (patient.value ? planMinutes(patient.value.plan.items) : 0));
</script>

<template>
  <div class="app-col ex-list">
    <NuxtLink :to="`/patient/${patientId}`" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("home") }}</NuxtLink>
    <p v-if="loadError" class="error">{{ loadError }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>
    <div v-else-if="!patient" class="card ex-loading" aria-busy="true" />

    <template v-else>
      <header class="ex-head">
        <p class="eyebrow">{{ T("sesToday") }}</p>
        <h1>{{ T("exCount", { n: items.length }) }}</h1>
        <p class="hint with-ic"><Clock class="ic" aria-hidden="true" /> {{ T("nowAbout", { n: minutes }) }}</p>
      </header>

      <p v-if="!items.length" class="card">{{ T("exNone") }}</p>
      <ol v-else class="ex-items">
        <li v-for="(it, i) in items" :key="it.exerciseId">
          <NuxtLink :to="`/patient/${patientId}/exercise/${it.exerciseId}`" class="ex-card">
            <span class="ex-num" aria-hidden="true">{{ i + 1 }}</span>
            <img v-if="it.thumb" :src="it.thumb" alt="" class="ex-thumb" loading="lazy" />
            <span class="ex-main">
              <b>{{ it.e.name[lang] }}</b>
              <span class="hint">{{ T("tutDose", { sets: it.sets, reps: it.reps }) }}<template v-if="it.e.holdSeconds"> · {{ T("tutHoldShort", { n: it.e.holdSeconds }) }}</template></span>
              <span class="ex-how">{{ T("howToDo") }}</span>
            </span>
            <ChevronRight class="ic" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ol>

      <NuxtLink v-if="items.length" :to="`/patient/${patientId}/session`" class="primary big-btn ex-go"><Play class="ic" aria-hidden="true" /> {{ T("tutStartSession") }}</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ex-loading { min-height: 240px; }
.ex-head { display: grid; gap: 4px; }
.ex-head h1 { font-size: clamp(1.5rem, 6vw, 2rem); }
.ex-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.ex-card { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-sm); color: var(--ink); text-decoration: none; transition: transform var(--dur-press) var(--ease-out); }
.ex-card:active { transform: scale(0.98); }
.ex-num { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border-radius: 50%; background: var(--pine); color: var(--surface); font-weight: 700; }
.ex-thumb { width: 88px; height: 60px; flex: none; object-fit: cover; border-radius: 10px; background: var(--sunken); }
.ex-main { display: grid; gap: 2px; flex: 1; min-width: 0; }
.ex-main b { font-size: 1.0625rem; }
.ex-how { color: var(--pine); font-weight: 700; font-size: 0.9375rem; }
.ex-go { position: sticky; bottom: 12px; display: flex; justify-content: center; gap: 8px; align-items: center; text-decoration: none; }
</style>
