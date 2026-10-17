<script setup lang="ts">
import { Phone, Sparkles } from "lucide-vue-next";
import { exerciseById } from "#shared/exercises";
import { formBand, sessionForm } from "#shared/form";
import type { TextKey } from "#shared/i18n";
import type { Patient } from "#shared/model";

// What the patient sees after a session: the next step, sets, pain and what the coach remembered.
const props = defineProps<{ patientId: string; sessionId: string }>();
const api = useApi("patient");
const lang = useLang();
const T = useT();
const version = useDataVersion();
const p = ref<Patient | null>(null);
const error = ref("");
async function load() {
  try {
    p.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient;
  } catch (e) {
    error.value = errorMessage(e);
  }
}
onMounted(load);
watch(version, load);

const s = computed(() => p.value?.sessions.find((x) => x.id === props.sessionId));
// Things the coach saved during this session (the hour before it was saved).
const inSession = (at: string) => !!s.value && Date.parse(s.value.at) - Date.parse(at) < 3_600_000 && Date.parse(at) <= Date.parse(s.value.at) + 60_000;
const memories = computed(() => (p.value?.memories ?? []).filter((m) => m.source === "coach" && inSession(m.createdAt)));
const diary = computed(() => (p.value?.diary ?? []).filter((d) => d.source === "coach" && inSession(d.at)));
const alerted = computed(() => (p.value?.alerts ?? []).some((a) => a.sessionId === props.sessionId));
const distress = computed(() => s.value?.concern?.kind === "distress");
const danger = computed(() => !!s.value && (s.value.nextAction.kind === "stop_contact" || s.value.nextAction.kind === "rest_contact"));
const form = computed(() => (s.value ? sessionForm(s.value.exercises) : null));
const setsDone = computed(() => {
  const ex = s.value?.exercises ?? [];
  return `${ex.reduce((n, e) => n + e.logged.filter((v) => v !== null).length, 0)}/${ex.reduce((n, e) => n + e.sets, 0)}`;
});
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <div v-if="p && s" class="patient-view">
    <div class="celebrate">
      <p class="eyebrow">{{ T("summary") }}</p>
      <h1>{{ distress ? T("crisisTitle") : s.concern ? T("stopped") : s.nextAction.kind === "rest_contact" ? T("sessionDone") : T("greatWork") }}</h1>
      <div v-if="!s.concern && s.nextAction.kind !== 'rest_contact'" class="burst" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
    </div>

    <!-- SYS-01: distress gets support and a way to reach a person, never a cold "stopped". Fixed text, not AI. -->
    <section v-if="distress" class="crisis" role="alert">
      <p>{{ T("crisisBody") }}</p>
      <p><b>{{ T("crisisEmergency") }}</b></p>
      <a class="primary big-btn" href="tel:112"><Phone class="ic" aria-hidden="true" /> {{ T("callEmergency") }}</a>
    </section>

    <div v-if="!distress" class="bento">
      <div class="tile wide" :class="danger ? 'danger' : 'sun'">
        <b>{{ T(`next_${s.nextAction.kind}` as TextKey) }}</b>
        <UiReadAloud style="justify-self: start; align-self: flex-start" :text="T(`next_${s.nextAction.kind}` as TextKey)" />
      </div>
      <NuxtLink v-if="$route.path.startsWith('/patient/')" :to="`/patient/${patientId}/journey`" class="tile wide link">{{ T("journeyTitle") }} →</NuxtLink>

      <!-- What the AI did during this session, so it is visible and accountable. -->
      <div v-if="memories.length || diary.length || alerted" class="tile wide">
        <span class="tile-label"><Sparkles class="ic" aria-hidden="true" /> {{ T("aiActivity") }}</span>
        <div class="chips">
          <span v-for="m in memories" :key="m.id" class="chip"><Sparkles class="ic" aria-hidden="true" /> {{ T("chipRemembered", { text: m.text }) }}</span>
          <span v-for="d in diary" :key="d.id" class="chip sky"><Sparkles class="ic" aria-hidden="true" /> {{ d.kind === "phantom_pain" ? T("chipPhantom", { n: d.score ?? "–" }) : `${T("mood")}: ${d.score ?? "–"}/10` }}</span>
          <span v-if="alerted" class="chip alert">🔔 {{ T("chipAlert") }}</span>
        </div>
      </div>

      <div class="tile wide">
        <ul class="exercise-list">
          <li v-for="e in s.exercises" :key="e.exerciseId">
            <b>{{ exerciseById(e.exerciseId)?.name[lang] }}</b>
            <span class="sets dose">
              <span v-for="(n, i) in e.logged" :key="i" class="set-chip" :class="{ missed: n === null, short: n !== null && n < e.reps }">{{ n ?? "–" }}/{{ e.reps }}</span>
            </span>
          </li>
        </ul>
      </div>
      <div class="tile navy">
        <span class="tile-label">{{ T("painCol") }}</span>
        <div class="tile-big on-night">{{ s.painBefore ?? "–" }} → {{ s.painAfter ?? "–" }}</div>
      </div>
      <div class="tile sky">
        <span class="tile-label">{{ T("sets") }}</span>
        <div class="tile-big">{{ setsDone }}</div>
      </div>
      <div class="tile wide">
        <span class="tile-label">{{ T("formSession") }}</span>
        <template v-if="form !== null">
          <div class="tile-big">{{ form }}<span class="hint">/100</span></div>
          <span>{{ T(`formBand_${formBand(form)}`) }}</span>
        </template>
        <span v-else class="hint">{{ T("formNone") }}</span>
      </div>
    </div>
    <slot />
  </div>
</template>
