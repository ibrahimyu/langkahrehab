<script setup lang="ts">
import type { Component } from "vue";
import { Activity, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, FileText, Flag, Play, ShieldCheck, Stethoscope, Target } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import type { Patient, Preferences } from "#shared/model";
import { addDays, buildIcs, calendarDays, currentTarget, dayKey, dayStart, monthGrid, nextVisit, parseSpokenTime, shiftMonth, weekOf, type CalDay, type CalEvent, type CalEventKind } from "#shared/calendar";

// "My calendar" (PAS-15): exercise days (done, not logged, today, planned), visits, skin checks,
// targets and plan changes. Week view by default on a phone; tap a day for its detail.
const props = defineProps<{ patientId: string }>();
const api = useApi("patient");
const T = useT();
const lang = useLang();
const toast = useToast();
const version = useDataVersion();

const data = ref<{ patient: Patient; now: number } | null>(null);
const error = ref("");
async function load() {
  error.value = "";
  try {
    data.value = await api(`/api/patients/${props.patientId}`);
  } catch (e) {
    error.value = errorMessage(e);
  }
}
onMounted(load);
watch(version, load);

const p = computed(() => data.value?.patient ?? null);
const now = computed(() => data.value?.now ?? Date.now());
const today = computed(() => dayKey(now.value));

// ---- View: week or month, and which one ----
const view = ref<"week" | "month">("week");
const anchor = ref("");
watch(today, (d) => (anchor.value ||= d), { immediate: true });
const dates = computed(() => (view.value === "week" ? weekOf(anchor.value) : monthGrid(anchor.value)));
const days = computed<CalDay[]>(() => (p.value ? calendarDays(p.value, now.value, dates.value) : []));
const showsToday = computed(() => dates.value.includes(today.value) && (view.value === "week" || anchor.value.slice(0, 7) === today.value.slice(0, 7)));
const step = (n: number) => (anchor.value = view.value === "week" ? addDays(anchor.value, 7 * n) : shiftMonth(anchor.value, n));

const fmt = (key: string, o: Intl.DateTimeFormatOptions) => new Date(dayStart(key)).toLocaleDateString(locale(lang.value), o);
const periodLabel = computed(() => {
  if (view.value === "month") return fmt(anchor.value, { month: "long", year: "numeric" });
  const w = dates.value;
  return `${fmt(w[0]!, { day: "numeric", month: "short" })} – ${fmt(w[6]!, { day: "numeric", month: "short" })}`;
});
const weekdayHead = [1, 2, 3, 4, 5, 6, 0].map((d) => `day_${d}` as TextKey);

const empty = computed(() => !!p.value && !p.value.preferences.exerciseDays.length && !days.value.some((d) => d.events.length));

// ---- Events ----
const icons: Record<CalEventKind, Component> = { session: Check, doctor_review: Stethoscope, therapy: Activity, skin_check: ShieldCheck, target_done: Flag, plan_change: FileText };
function eventLabel(e: CalEvent) {
  const base = T(`ev_${e.kind}` as TextKey, { n: e.n ?? "" });
  return e.text && e.kind !== "target_done" && e.kind !== "skin_check" ? `${base} · ${e.text}` : base;
}
const visibleEvents = (d: CalDay) => d.events.filter((e) => e.kind !== "session");

// ---- Day detail ----
const openDay = ref<CalDay | null>(null);
const dayTitle = (key: string) => fmt(key, { weekday: "long", day: "numeric", month: "long" });

// ---- Working on, next visit, .ics ----
const target = computed(() => (p.value ? currentTarget(p.value) : null));
const visit = computed(() => (p.value ? nextVisit(p.value, now.value) : null));
function downloadIcs() {
  const v = visit.value;
  if (!v) return;
  const title = eventLabel(v);
  const ics = buildIcs(v, `${title} (Langkah)`, T("calIcsNote"), `${props.patientId}-${v.kind}-${v.date}@langkah`, now.value);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = `langkah-${v.date}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast.show(T("calAdded"), { tone: "good" });
}

// ---- Exercise time and days (the patient's own settings; reminders use them, SYS-11) ----
const editingTime = ref(false);
async function savePrefs(patch: Partial<Preferences>, undo?: Partial<Preferences>, msg = T("saved")) {
  try {
    const prefs = await api<Preferences>(`/api/patients/${props.patientId}/preferences`, { method: "PUT", body: patch });
    p.value!.preferences = prefs;
    toast.show(msg, { tone: "good", undo: undo ? () => void savePrefs(undo) : undefined });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}
function setTime(time: string | null) {
  const before = p.value!.preferences.exerciseTime;
  if (time === before) return;
  editingTime.value = false;
  void savePrefs({ exerciseTime: time }, { exerciseTime: before }, time ? T("calTimeSaved", { time }) : T("saved"));
}
function heardTime(said: string) {
  const time = parseSpokenTime(said);
  if (time) setTime(time);
  else toast.show(T("calTimeNotHeard"), { tone: "bad" });
}
function toggleDay(d: number) {
  const before = p.value!.preferences.exerciseDays;
  void savePrefs({ exerciseDays: before.includes(d) ? before.filter((x) => x !== d) : [...before, d] }, { exerciseDays: before });
}
</script>

<template>
  <section class="cal">
    <header class="cal-head">
      <h1>{{ T("calTitle") }}</h1>
      <div class="seg" role="group" :aria-label="T('calTitle')">
        <button :class="{ on: view === 'week' }" :aria-pressed="view === 'week'" @click="view = 'week'">{{ T("calWeek") }}</button>
        <button :class="{ on: view === 'month' }" :aria-pressed="view === 'month'" @click="view = 'month'">{{ T("calMonth") }}</button>
      </div>
    </header>

    <div v-if="error" class="card stack">
      <p class="error">{{ error }}</p>
      <button class="ghost" @click="load">{{ T("tryAgain") }}</button>
    </div>

    <div v-else-if="!p" class="stack" aria-busy="true">
      <div class="card skel" style="height: 72px" />
      <div class="card skel" style="height: 360px" />
    </div>

    <template v-else>
      <!-- Empty: one card that can be filled straight away -->
      <article v-if="empty" class="card stack empty-card">
        <p class="empty-lede">{{ T("calEmpty") }}</p>
        <div class="field"><span>{{ T("calPickDays") }}</span>
          <div class="day-row">
            <button v-for="d in [1, 2, 3, 4, 5, 6, 0]" :key="d" type="button" class="day" :class="{ on: p.preferences.exerciseDays.includes(d) }" :aria-pressed="p.preferences.exerciseDays.includes(d)" @click="toggleDay(d)">{{ T(`day_${d}` as TextKey) }}</button>
          </div>
        </div>
      </article>

      <template v-else>
        <!-- Period navigation -->
        <nav class="cal-nav">
          <button class="ghost icon-btn" :aria-label="T('calPrev')" @click="step(-1)"><ChevronLeft class="ic" aria-hidden="true" /></button>
          <h2 aria-live="polite">{{ periodLabel }}</h2>
          <button v-if="!showsToday" class="link" @click="anchor = today">{{ T("calBackToday") }}</button>
          <button class="ghost icon-btn" :aria-label="T('calNext')" @click="step(1)"><ChevronRight class="ic" aria-hidden="true" /></button>
        </nav>

        <!-- Week: one readable row per day -->
        <ol v-if="view === 'week'" class="week">
          <li v-for="d in days" :key="d.date">
            <button class="week-row" :class="[d.exercise, { now: d.date === today }]" @click="openDay = d">
              <span class="week-date">
                <span class="week-wd">{{ fmt(d.date, { weekday: "short" }) }}</span>
                <span class="week-n">{{ fmt(d.date, { day: "numeric" }) }}</span>
              </span>
              <span class="week-body">
                <span v-if="d.exercise" class="ex-line">
                  <span class="mark" :class="d.exercise" aria-hidden="true"><Check v-if="d.exercise === 'done'" class="ic" /></span>
                  {{ T(`ex_${d.exercise}` as TextKey) }}<template v-if="d.exercise !== 'done' && d.exercise !== 'missed' && p.preferences.exerciseTime"> · {{ p.preferences.exerciseTime }}</template>
                </span>
                <span v-for="(e, i) in visibleEvents(d)" :key="i" class="ev-line" :class="e.kind">
                  <component :is="icons[e.kind]" class="ic" aria-hidden="true" /> {{ eventLabel(e) }}
                </span>
                <span v-if="!d.exercise && !visibleEvents(d).length" class="hint">–</span>
              </span>
              <ChevronRight class="ic chev" aria-hidden="true" />
            </button>
          </li>
        </ol>

        <!-- Month: a grid with marks; the detail is one tap away -->
        <div v-else class="card month">
          <div class="month-grid" role="grid">
            <span v-for="k in weekdayHead" :key="k" class="month-wd" aria-hidden="true">{{ T(k) }}</span>
            <button
              v-for="d in days" :key="d.date" class="month-cell" :class="[d.exercise, { out: d.date.slice(0, 7) !== anchor.slice(0, 7), now: d.date === today }]"
              :aria-label="`${dayTitle(d.date)}${d.exercise ? ', ' + T(`ex_${d.exercise}` as TextKey) : ''}${visibleEvents(d).map((e) => ', ' + eventLabel(e)).join('')}`"
              @click="openDay = d"
            >
              <span class="month-n">{{ fmt(d.date, { day: "numeric" }) }}</span>
              <span class="mark" :class="d.exercise" aria-hidden="true"><Check v-if="d.exercise === 'done'" class="ic" /></span>
              <span v-if="visibleEvents(d).length" class="dots" aria-hidden="true"><span v-for="(e, i) in visibleEvents(d).slice(0, 3)" :key="i" class="dot" :class="e.kind" /></span>
            </button>
          </div>
          <ul class="legend">
            <li><span class="mark done" aria-hidden="true"><Check class="ic" /></span> {{ T("ex_done") }}</li>
            <li><span class="mark planned" aria-hidden="true" /> {{ T("ex_planned") }}</li>
            <li><span class="mark missed" aria-hidden="true" /> {{ T("ex_missed") }}</li>
            <li><span class="dot doctor_review" aria-hidden="true" /> {{ T("ev_doctor_review") }}</li>
            <li><span class="dot therapy" aria-hidden="true" /> {{ T("ev_therapy") }}</li>
          </ul>
        </div>
      </template>

      <!-- Exercise time: tap to change, or say it -->
      <article class="card time-card">
        <span class="time-ic"><Clock class="ic" aria-hidden="true" /></span>
        <div class="time-main">
          <template v-if="!editingTime">
            <b>{{ p.preferences.exerciseTime ? T("calExerciseAt", { time: p.preferences.exerciseTime }) : T("calNoTime") }}</b>
            <button class="link" @click="editingTime = true">{{ T("calSetTime") }}</button>
          </template>
          <label v-else class="field">
            <span>{{ T("exerciseTime") }}</span>
            <input type="time" :value="p.preferences.exerciseTime ?? ''" autofocus @change="setTime(($event.target as HTMLInputElement).value || null)" @keydown.escape="editingTime = false" />
          </label>
        </div>
        <UiMicButton @text="heardTime" />
      </article>

      <div class="cards-2">
        <NuxtLink v-if="target" :to="`/patient/${patientId}/goals`" class="card mini-card">
          <span class="mini-k"><Target class="ic" aria-hidden="true" /> {{ T("calWorkingOn") }}</span>
          <b class="mini-v">{{ target.text }}</b>
        </NuxtLink>
        <article v-if="visit" class="card mini-card">
          <span class="mini-k"><Stethoscope class="ic" aria-hidden="true" /> {{ T("calNextVisit") }}</span>
          <b class="mini-v">{{ eventLabel(visit) }}</b>
          <span class="hint">{{ dayTitle(visit.date) }}<template v-if="visit.time"> · {{ visit.time }}</template></span>
          <button class="ghost" @click="downloadIcs"><CalendarPlus class="ic" aria-hidden="true" /> {{ T("calAddToPhone") }}</button>
        </article>
      </div>

    </template>

    <UiSheet :open="!!openDay" :title="openDay ? dayTitle(openDay.date) : ''" @close="openDay = null">
      <div v-if="openDay && p" class="stack">
        <p v-if="openDay.exercise" class="ex-line big">
          <span class="mark" :class="openDay.exercise" aria-hidden="true"><Check v-if="openDay.exercise === 'done'" class="ic" /></span>
          {{ T(`ex_${openDay.exercise}` as TextKey) }}<template v-if="openDay.exercise === 'today' || openDay.exercise === 'planned'"><template v-if="p.preferences.exerciseTime"> · {{ p.preferences.exerciseTime }}</template></template>
        </p>
        <NuxtLink v-if="openDay.exercise === 'today'" :to="`/patient/${patientId}/session`" class="primary big-btn"><Play class="ic" aria-hidden="true" /> {{ T("start") }}</NuxtLink>
        <ul v-if="openDay.events.length" class="sheet-list">
          <li v-for="(e, i) in openDay.events" :key="i" class="sheet-ev">
            <span class="ev-ic" :class="e.kind"><component :is="icons[e.kind]" class="ic" aria-hidden="true" /></span>
            <span class="sheet-ev-main">
              <b>{{ eventLabel(e) }}</b>
              <span v-if="e.kind === 'target_done'" class="hint">{{ e.text }}</span>
              <span v-if="e.time" class="hint">{{ e.time }}</span>
            </span>
            <NuxtLink v-if="e.to" :to="e.to" class="link">{{ T("open") }}</NuxtLink>
          </li>
        </ul>
        <p v-else-if="!openDay.exercise" class="hint">{{ T("calNothing") }}</p>
        <button v-if="visit && openDay.date === visit.date" class="ghost big-btn" @click="downloadIcs"><CalendarPlus class="ic" aria-hidden="true" /> {{ T("calAddToPhone") }}</button>
      </div>
    </UiSheet>
  </section>
</template>

<style scoped>
.cal { display: grid; gap: 14px; }
.cal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cal-head h1 { font-size: 1.5rem; }
.skel { background: var(--sunken); box-shadow: none; }

.time-card { display: flex; align-items: center; gap: 12px; }
.time-ic, .ev-ic { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 12px; background: var(--pine-soft); color: var(--pine); }
.time-main { display: grid; gap: 2px; flex: 1; min-width: 0; }
.time-main .link { justify-self: start; }

.empty-lede { font-size: 1.0625rem; font-weight: 600; }
.day-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.day { min-height: 44px; border-radius: var(--r-btn); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink-2); font-weight: 700; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.day:active { transform: scale(0.95); }
.day.on { background: var(--pine); border-color: var(--pine); color: var(--surface); }

.cards-2 { display: grid; gap: 10px; }
@media (min-width: 520px) { .cards-2 { grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); } }
.mini-card { display: grid; gap: 6px; align-content: start; color: inherit; text-decoration: none; }
.mini-k { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; font-weight: 700; color: var(--ink-3); }
.mini-k .ic { width: 16px; height: 16px; }
.mini-v { font-size: 1.0625rem; }
.mini-card .ghost { justify-self: start; margin-top: 4px; }

.cal-nav { display: flex; align-items: center; gap: 8px; }
.cal-nav h2 { flex: 1; font-size: 1.125rem; }
.icon-btn { min-width: 44px; min-height: 44px; padding: 0; display: grid; place-items: center; }

/* Exercise marks: done = filled pine, today = ring, planned = outline, missed = neutral grey (never red). */
.mark { display: inline-grid; place-items: center; flex: none; width: 22px; height: 22px; border-radius: 50%; }
.mark .ic { width: 14px; height: 14px; stroke-width: 3; }
.mark.done { background: var(--pine); color: var(--surface); }
.mark.today { box-shadow: inset 0 0 0 3px var(--pine); }
.mark.planned { box-shadow: inset 0 0 0 2px var(--line-strong); }
.mark.missed { background: var(--sunken); box-shadow: inset 0 0 0 2px var(--line); }

.week { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.week-row { width: 100%; display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 10px 12px; border: 0; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-sm); color: var(--ink); text-align: left; font: inherit; cursor: pointer; transition: transform var(--dur-press) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
.week-row:active { transform: scale(0.985); }
.week-row.now { box-shadow: inset 0 0 0 2px var(--pine), var(--shadow-sm); }
.week-date { display: grid; justify-items: center; width: 44px; flex: none; }
.week-wd { font-size: 0.8125rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; }
.week-n { font: 700 1.375rem/1.1 var(--display); }
.week-row.now .week-n { color: var(--pine); }
.week-body { display: grid; gap: 4px; flex: 1; min-width: 0; }
.ex-line, .ev-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ex-line { font-weight: 600; }
.week-row.missed .ex-line { color: var(--ink-3); font-weight: 500; }
.ev-line { font-size: 0.9375rem; color: var(--ink-2); }
.ev-line .ic { width: 18px; height: 18px; flex: none; color: var(--pine); }
.ev-line.doctor_review .ic, .ev-line.plan_change .ic { color: var(--dawn-ink); }
.chev { flex: none; width: 18px; height: 18px; color: var(--ink-3); }

.month { padding: 12px; }
.month-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.month-wd { text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--ink-3); padding-bottom: 4px; }
.month-cell { display: grid; justify-items: center; align-content: start; gap: 3px; min-height: 64px; padding: 6px 0; border: 0; border-radius: 12px; background: none; color: var(--ink); font: inherit; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.month-cell:active { transform: scale(0.94); }
.month-cell.now { background: var(--pine-soft); }
.month-cell.out { opacity: 0.4; }
.month-n { font-weight: 700; font-size: 0.9375rem; }
.month-cell.now .month-n { color: var(--pine); }
.dots { display: flex; gap: 3px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--pine); }
.dot.doctor_review, .dot.plan_change { background: var(--dawn-ink); }
.dot.skin_check, .dot.target_done { background: var(--ink-3); }
.legend { list-style: none; margin: 12px 0 0; padding: 12px 4px 0; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 0.8125rem; color: var(--ink-2); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend .mark { width: 18px; height: 18px; }
.legend .mark .ic { width: 12px; height: 12px; }
@media (hover: hover) {
  .month-cell:hover { background: var(--sunken); }
  .week-row:hover { box-shadow: var(--shadow-md); }
}

.ex-line.big { font-size: 1.0625rem; }
.sheet-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.sheet-ev { display: flex; align-items: center; gap: 12px; }
.ev-ic.doctor_review, .ev-ic.plan_change { background: var(--dawn-soft); color: var(--dawn-ink); }
.ev-ic.skin_check, .ev-ic.target_done { background: var(--sunken); color: var(--ink-2); }
.sheet-ev-main { display: grid; gap: 2px; flex: 1; min-width: 0; }
</style>
