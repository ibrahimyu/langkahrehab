<script setup lang="ts">
import { Camera, Hand, Mic, ShieldAlert } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import type { CountMode, Patient, SessionRecord } from "#shared/model";

// Sessions (FIS-05): one row per session with how reps were counted, the plan version and any concern.
const props = defineProps<{ patient: Patient }>();
const T = useT();
const lang = useLang();
const limit = ref(10);
const list = computed(() => [...props.patient.sessions].reverse());
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { weekday: "short", day: "numeric", month: "short" });
const modeIcon: Record<CountMode, typeof Camera> = { camera: Camera, patient: Hand, coach: Mic };
const sets = (s: SessionRecord) => `${s.exercises.reduce((n, e) => n + e.logged.filter((v) => v !== null).length, 0)}/${s.exercises.reduce((n, e) => n + e.sets, 0)}`;
</script>

<template>
  <section class="cr-section">
    <h2>{{ T("sessions") }} <span class="pill">{{ list.length }}</span></h2>
    <ul v-if="list.length" class="cr-list">
      <li v-for="s in list.slice(0, limit)" :key="s.id" class="card cr-item cr-sess" :class="{ concern: s.concern }">
        <div class="cr-top">
          <b>{{ day(s.at) }}</b>
          <span class="cr-actions">
            <span class="pill"><component :is="modeIcon[s.mode]" class="ic" aria-hidden="true" /> {{ T(`crMode_${s.mode}` as TextKey) }}</span>
            <span class="pill">v{{ s.planVersion }}</span>
          </span>
        </div>
        <dl class="cr-sess-nums">
          <div><dt>{{ T("sets") }}</dt><dd>{{ sets(s) }}</dd></div>
          <div :class="{ over: (s.painAfter ?? 0) >= patient.plan.painThreshold }"><dt>{{ T("painCol") }}</dt><dd>{{ s.painBefore ?? "–" }} → {{ s.painAfter ?? "–" }}</dd></div>
          <div><dt>{{ T("felt") }}</dt><dd>{{ s.difficulty ? T(`diff_${s.difficulty}` as TextKey) : "–" }}</dd></div>
        </dl>
        <p v-if="s.concern" class="cr-concern"><ShieldAlert class="ic" aria-hidden="true" /> <span><b>{{ T("kind_red_flag") }}</b> · {{ s.concern.details || s.concern.kind }} <span class="cr-meta">· {{ T(`crConcernSrc_${s.concern.source ?? "coach"}` as TextKey) }}</span></span></p>
        <p v-else class="cr-meta">{{ T(`next_${s.nextAction.kind}` as TextKey) }}</p>
      </li>
    </ul>
    <div v-else class="card cr-empty"><p>{{ T("noSessions") }}</p></div>
    <button v-if="list.length > limit" class="ghost" @click="limit += 10">{{ T("crShowMore") }}</button>
  </section>
</template>

<style scoped>
.cr-sess { padding: 14px; }
.cr-sess.concern { box-shadow: var(--shadow-sm), inset 4px 0 0 var(--danger); }
.cr-sess-nums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
.cr-sess-nums div { min-width: 0; }
.cr-sess-nums dt { font-size: 0.75rem; color: var(--ink-3); }
.cr-sess-nums dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.cr-sess-nums .over dd { color: var(--danger-ink); }
.cr-concern { display: flex; gap: 8px; padding: 10px 12px; border-radius: 12px; background: var(--danger-soft); color: var(--danger-ink); overflow-wrap: anywhere; }
.cr-concern .ic { flex: none; margin-top: 2px; }
</style>
