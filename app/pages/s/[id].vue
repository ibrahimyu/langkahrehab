<script setup lang="ts">
import { scenarioById, stepInstruction, stepLabel, scenarios } from "#shared/scenarios";

// Guided scenario: the patient's phone, step by step. The physio dashboard appears when switched on.
const route = useRoute();
const router = useRouter();
const T = useT();
const api = useApi();
const version = useDataVersion();
const scenario = scenarioById(route.params.id as string);
if (!scenario) throw createError({ statusCode: 404, statusMessage: "Scenario not found" });

const stepIndex = computed(() => Math.min(scenario.steps.length - 1, Math.max(0, Number(route.query.step ?? 0) || 0)));
const step = computed(() => scenario.steps[stepIndex.value]!);
const sessionId = computed(() => (route.query.session as string | undefined) ?? "");
const dashboard = ref(false);
const name = ref("");

onMounted(async () => {
  try {
    name.value = (await api<{ patient: { name: string } }>(`/api/patients/${scenario.patientId}`)).patient.name;
  } catch {}
});

function goTo(i: number, extra: Record<string, string> = {}) {
  router.push({ query: { ...route.query, step: String(i), ...extra } });
}
const next = (extra: Record<string, string> = {}) => goTo(stepIndex.value + 1, extra);
const isLast = computed(() => stepIndex.value === scenario.steps.length - 1);

watch(step, (s) => {
  if (s === scenario.dashboardAt) dashboard.value = true;
}, { immediate: true });

// "Next day" moves the demo clock once when the step is first shown.
const advanced = new Set<number>();
watch(step, async (s) => {
  if (s !== "next_day" || advanced.has(stepIndex.value) || route.query.advanced) return;
  advanced.add(stepIndex.value);
  await api("/api/demo/next-day", { method: "POST" });
  router.replace({ query: { ...route.query, advanced: "1" } });
  version.value++;
}, { immediate: true });

const others = computed(() => scenarios.filter((s) => s.id !== scenario.id));
const { start } = useScenarioStart();
</script>

<template>
  <div class="runner-head">
    <div class="bar">
      <div>
        <NuxtLink to="/" class="link">← {{ T("allScenarios") }}</NuxtLink>
        <h1>{{ T(scenario.title) }}</h1>
      </div>
      <button class="toggle" :aria-pressed="dashboard" @click="dashboard = !dashboard">
        {{ scenario.careRole === "doctor" ? T("dashboardDoctor") : T("dashboard") }} <span class="switch" :class="{ on: dashboard }" />
      </button>
    </div>
    <div class="story">
      <div class="story-bars" role="tablist">
        <button v-for="(s, i) in scenario.steps" :key="s" role="tab" :aria-selected="i === stepIndex" :aria-label="T(stepLabel(s))" :class="{ on: i === stepIndex, done: i < stepIndex }" @click="goTo(i)" />
      </div>
      <div class="story-label">
        <span><b>{{ T(stepLabel(step)) }}</b> · {{ T(stepInstruction(scenario, step)) }}</span>
        <span>{{ T("stepOf", { n: stepIndex + 1, m: scenario.steps.length }) }}</span>
      </div>
    </div>
  </div>

  <div class="stage-row">
    <div class="phone-col">
      <div class="phone">
        <Transition name="step" mode="out-in">
        <div :key="`${step}-${sessionId}`" class="stack">
        <PatientHome v-if="step === 'meet'" :patient-id="scenario.patientId" variant="meet" @start="next()" />
        <PatientSession v-else-if="step === 'exercise'" :patient-id="scenario.patientId" :simulation="scenario.simulation" @saved="(sid) => next({ session: sid })" />
        <template v-else-if="step === 'summary'">
          <PatientSummary v-if="sessionId" :patient-id="scenario.patientId" :session-id="sessionId" />
          <button v-else class="ghost" @click="goTo(scenario.steps.indexOf('exercise'))">← {{ T("step_exercise") }}</button>
        </template>
        <PatientHome v-else-if="step === 'next_day' || step === 'visit' || step === 'checkup'" :patient-id="scenario.patientId" variant="home" @start="goTo(scenario.steps.indexOf('exercise') >= 0 ? scenario.steps.indexOf('exercise') : stepIndex)" />
        <PatientSkin v-else-if="step === 'skin'" :patient-id="scenario.patientId" />
        <button v-if="!isLast && step !== 'meet' && step !== 'exercise'" class="primary big-btn pill-btn" @click="next()">{{ T("nextStep") }}</button>
        </div>
        </Transition>
      </div>
      <p class="phone-cap">{{ T("whatSees", { name: name || "…" }) }}</p>
    </div>

    <div v-if="dashboard" class="dash-col">
      <CarePanel :patient-id="scenario.patientId" :role="scenario.careRole ?? 'physio'" compact />
    </div>
    <p v-else class="dash-hint">{{ scenario.careRole === "doctor" ? T("dashOffDoctor") : T("dashOff") }}</p>
  </div>

  <section v-if="isLast" class="card stack" style="margin-top: 20px">
    <h2>{{ T("scenarioDone") }}</h2>
    <div class="controls">
      <button v-for="s in others" :key="s.id" class="ghost" @click="start(s)">{{ T(s.title) }}</button>
    </div>
  </section>
</template>
