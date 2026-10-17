<script setup lang="ts">
import { Sparkles, Target, ChevronRight, HeartHandshake, Footprints, Play, Square, Volume2, Flame, TrendingUp, Route, BookOpen, MessageCircleQuestion } from "lucide-vue-next";
import { exerciseById } from "#shared/exercises";
import { limbLine, limbsOf } from "#shared/limbs";
import { ago, locale, profileText, stories, type TextKey } from "#shared/i18n";
import { DAY, type Patient } from "#shared/model";
import { daysSinceSession, reviewDay, weekAdherence } from "#shared/rules";
import { nextTarget } from "#shared/goals";
import { planMinutes, repsSinceLastWeek, streakDays } from "#shared/home";
import { dayKey } from "#shared/calendar";
import { computeJourneyStage } from "#shared/journey";

// The patient's home screen. "meet" introduces the patient (photo, X-ray, goal) for a scenario;
// "home" is the everyday screen with progress, check-ups and the skin check.
const props = defineProps<{ patientId: string; variant: "meet" | "home" }>();
const emit = defineEmits<{ start: []; skin: [] }>();

const api = useApi("patient");
const lang = useLang();
const T = useT();
const version = useDataVersion();
const data = ref<{ patient: Patient; now: number } | null>(null);
const error = ref("");
async function load() {
  try {
    data.value = await api(`/api/patients/${props.patientId}`);
  } catch (e) {
    error.value = errorMessage(e);
  }
}
onMounted(load);
watch(version, load);

const p = computed(() => data.value?.patient);
const now = computed(() => data.value?.now ?? Date.now());
const goal = computed(() => p.value?.memories.find((m) => m.kind === "goal")?.text);
const last = computed(() => p.value?.sessions.at(-1));
const advice = computed(() => {
  const s = last.value;
  // Advice is for the day of the session; after that the plan (or a check-up) takes over.
  if (!s || s.nextAction.kind === "keep_going" || now.value - Date.parse(s.at) > DAY) return null;
  // A check-up booked for a later day is shown with its date, not as "time for your check-up".
  if (s.nextAction.kind === "review_due") {
    const day = reviewDay(p.value!);
    if (day > dayKey(now.value)) return { text: T("next_review_on", { date: fmt(day, { weekday: "long", day: "numeric", month: "long" }) }), danger: false };
  }
  return { text: T(`next_${s.nextAction.kind}` as TextKey), danger: s.nextAction.kind === "stop_contact" || s.nextAction.kind === "rest_contact" };
});
const sinceLast = computed(() => (p.value ? daysSinceSession(p.value, now.value) : null));
const newPlan = computed(() => !!p.value && p.value.plan.version > 1 && now.value - Date.parse(p.value.plan.updatedAt) < 2 * DAY);
const adherence = computed(() => (p.value ? weekAdherence(p.value, now.value) : null));
const painSeries = computed(() => (p.value?.sessions ?? []).filter((s) => s.painAfter !== null).slice(-7));
const fmt = (d: string | number, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString(locale(lang.value), o);
const limbs = computed(() => (p.value ? limbsOf(p.value.profile) : []));
const profileLine = computed(() => limbs.value.map((l) => limbLine(lang.value, l)).join(" + "));

// SYS-05: a session that could not be saved is kept on this phone until it goes through.
const pending = usePendingSession(props.patientId);
const sending = ref(false);
async function sendPending() {
  sending.value = true;
  try {
    await pending.send();
    version.value++;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    sending.value = false;
  }
}

// Every card opens its detail (a page in the patient app, or a sheet). In a guided scenario the
// cards stay inside the scenario, so page links are only used in the patient app.
const route = useRoute();
const inApp = computed(() => route.path.startsWith("/patient/"));
const base = computed(() => `/patient/${props.patientId}`);
const sheet = ref<"plan" | "pain" | null>(null);
const roleKey = { patient: "rolePatient", physio: "rolePhysio", doctor: "roleDoctor", family: "roleFamily", admin: "roleAdmin" } as const;
const mainGoal = computed(() => p.value?.goals.find((g) => g.main)?.text ?? goal.value);
const painList = computed(() => [...(p.value?.sessions ?? [])].reverse().slice(0, 14));
// The pain sheet: before/after per session (oldest first), the doctor's limit, and what the trend means.
const painChart = computed(() => [...painList.value].reverse().filter((s) => s.painAfter !== null || s.painBefore !== null));
const painTrend = computed(() => {
  const after = painChart.value.map((s) => s.painAfter).filter((v): v is number => v !== null);
  if (after.length < 3) return null;
  const first = Math.round((after[0]! + after[1]!) / 2);
  const last = Math.round((after.at(-1)! + after.at(-2)!) / 2);
  const limit = p.value!.plan.painThreshold;
  const kind = last >= limit ? "over" : last > first ? "up" : last < first ? "down" : "same";
  return { kind, first, last, limit };
});

// ---- Now card, next step, other foot, and true moments of progress (PAS-01) ----
const minutes = computed(() => (p.value ? planMinutes(p.value.plan.items) : 0));
const exerciseNames = computed(() => (p.value?.plan.items ?? []).map((i) => exerciseById(i.exerciseId)?.name[lang.value]).filter(Boolean).join(", "));
const next = computed(() => (p.value ? nextTarget(p.value.goals) : null));
const otherFoot = computed(() => {
  const q = p.value;
  if (!q || !["diabetes", "vascular"].includes(q.profile.cause) || q.profile.level === "none") return false;
  return !q.skinChecks.some((c) => c.area === "other_foot" && dayKey(Date.parse(c.at)) === dayKey(now.value));
});
const moment = computed(() => {
  const q = p.value;
  const s = q?.sessions.at(-1);
  if (!q || !s || dayKey(Date.parse(s.at)) !== dayKey(now.value)) return null;
  const streak = streakDays(q.sessions, now.value);
  if (streak >= 2) return { icon: Flame, text: T("streakN", { n: streak }) };
  const gain = repsSinceLastWeek(q.sessions);
  return gain && gain > 0 ? { icon: TrendingUp, text: T("repsGain", { n: gain }) } : null;
});
// Journey, questions and learning (PAS-03, PAS-05, PAS-16): one small list, each row opens its page.
const journeyStep = computed(() => (p.value ? computeJourneyStage(p.value) : 1));
const questionsWaiting = computed(() => (p.value?.notes ?? []).filter((n) => n.kind === "question" && !n.answeredAt && !n.reply).length);
const reader = useReadAloud();
const readNow = () => {
  const q = p.value!;
  reader.toggle([`${T("today")}: ${exerciseNames.value}. ${T("nowAbout", { n: minutes.value })}.`, q.plan.note ? `${T("note")}: ${q.plan.note}` : "", `${T("checkup")}: ${fmt(`${q.plan.reviewDate}T09:00:00`, { weekday: "long", day: "numeric", month: "long" })}.`].filter(Boolean).join(" "));
};

const asking = ref(false);
const reason = ref("");
const openRequest = computed(() => p.value?.checkIns.find((c) => c.status !== "done"));
async function askCheckup() {
  await api(`/api/patients/${props.patientId}/checkins`, { method: "POST", body: { kind: "therapy", reason: reason.value, role: "patient" } });
  asking.value = false;
  version.value++;
}
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <div v-if="pending.pendingCount.value" class="banner pending-banner" role="status">
    <span>{{ T("pendingSession") }}</span>
    <button class="primary small-btn" :disabled="sending" @click="sendPending">{{ sending ? T("saving") : T("sendNow") }}</button>
  </div>
  <div v-if="p" class="patient-view">
    <div class="greet">
      <MediaFrame class="avatar" :src="`/media/patients/${p.id}.jpg`" :label="p.name" icon="person" />
      <div>
        <h1>{{ T("hello", { name: p.name }) }}</h1>
        <p class="hint">{{ fmt(now, { weekday: "long", day: "numeric", month: "long" }) }}</p>
        <span v-if="moment" class="pill moment"><component :is="moment.icon" class="ic" aria-hidden="true" /> {{ moment.text }}</span>
      </div>
    </div>

    <div class="bento">
      <InstallHint v-if="variant === 'home'" :sessions="p.sessions.length" />

      <!-- Now: today's plan, how long it takes, and Start (PAS-01). Tap the card for the detail. -->
      <div class="tile wide now-card tap">
        <button class="tap-cover" :aria-label="T('today')" @click="sheet = 'plan'" />
        <div class="now-top">
          <span class="tile-label tap-label">{{ T("today") }} <ChevronRight class="ic" aria-hidden="true" /></span>
          <button v-if="reader.supported.value" class="ghost small-btn" :aria-pressed="reader.speaking.value" @click="readNow">
            <component :is="reader.speaking.value ? Square : Volume2" class="ic" aria-hidden="true" /> {{ reader.speaking.value ? T("stopReading") : T("readAloud") }}
          </button>
        </div>
        <b class="now-title">{{ exerciseNames }}</b>
        <span class="hint">{{ T("nowAbout", { n: minutes }) }}<template v-if="p.plan.note"> · “{{ p.plan.note }}”</template></span>
        <button class="primary big-btn now-start" @click="emit('start')"><Play class="ic" aria-hidden="true" /> {{ T("start") }}</button>
      </div>

      <!-- Advice, nudge or new plan comes first: it's what the patient needs to act on. -->
      <div v-if="advice" class="tile wide" :class="advice.danger ? 'danger' : 'sun'"><b>{{ advice.text }}</b></div>
      <div v-else-if="sinceLast !== null && sinceLast >= 2" class="tile wide sun"><b>{{ T("missedNudge", { name: p.name.split(" ").slice(0, 2).join(" ") }) }}</b></div>
      <div v-if="newPlan && variant === 'home'" class="tile wide sky tap">
        <button class="tap-cover" :aria-label="T('newPlan')" @click="sheet = 'plan'" />
        <span class="tile-label"><Sparkles class="ic" aria-hidden="true" /> {{ T("newPlan") }}</span>
        <p v-if="p.plan.note">“{{ p.plan.note }}”</p>
      </div>

      <template v-if="variant === 'meet'">
        <div class="tile wide"><p>{{ stories[p.id]?.[lang] ?? p.story }}</p></div>
        <MediaFrame v-if="limbs.length" :src="`/media/xray/${p.id}.png`" :label="T('amputationLevel')" style="aspect-ratio: 3 / 4; border-radius: 22px">
          <template #fallback><LimbDiagram :profile="p.profile" :label="T('amputationLevel')" /></template>
        </MediaFrame>
        <div class="tile" :class="{ wide: !limbs.length }">
          <span class="tile-label">{{ T("amputationLevel") }}</span>
          <b>{{ profileLine || profileText(lang, p.profile) }}</b>
          <p v-if="p.profile.restrictions" class="hint">{{ p.profile.restrictions }}</p>
          <template v-if="goal">
            <span class="tile-label" style="margin-top: 6px">{{ T("goal") }}</span>
            <p class="goal"><Target class="ic" aria-hidden="true" /> {{ goal }}</p>
          </template>
        </div>
      </template>

      <div v-else class="tile wide navy" :class="{ tap: inApp }">
        <NuxtLink v-if="inApp" :to="`${base}/calendar`" class="tap-cover" :aria-label="T('tabCalendar')" />
        <div class="ring-row">
          <ProgressRing :value="adherence ?? 0" />
          <div>
            <div class="tile-big on-night">{{ adherence ?? 0 }}%</div>
            <p class="on-night-2">{{ T("thisWeek") }}</p>
            <p class="on-night-2 hint-night">{{ T("last") }}: {{ sinceLast === null ? T("noSessions") : ago(lang, sinceLast) }}</p>
          </div>
        </div>
      </div>


      <template v-if="variant === 'home'">
        <div v-if="mainGoal" class="tile sun" :class="{ tap: inApp }">
          <NuxtLink v-if="inApp" :to="`${base}/goals`" class="tap-cover" :aria-label="T('goal')" />
          <span class="tile-label tap-label" style="color: var(--warn-ink)">{{ next ? T("nextStep") : T("goal") }} <ChevronRight v-if="inApp" class="ic" aria-hidden="true" /></span>
          <b class="with-ic"><Target class="ic" aria-hidden="true" /> {{ next ? next.target.text : mainGoal }}</b>
          <span v-if="next" class="hint goal-of">{{ next.goal.text }}</span>
        </div>
        <div class="tile sky" :class="{ wide: !mainGoal, tap: painList.length }">
          <button v-if="painList.length" class="tap-cover" :aria-label="T('pain')" @click="sheet = 'pain'" />
          <span class="tile-label tap-label">{{ T("pain") }} <ChevronRight v-if="painList.length" class="ic" aria-hidden="true" /></span>
          <div v-if="painSeries.length" class="bars" style="height: 56px">
            <div v-for="s in painSeries" :key="s.id" class="bar-col" :title="`${s.at.slice(0, 10)}: ${s.painAfter}/10`">
              <div class="bar-fill" :class="{ high: s.painAfter! >= p.plan.painThreshold }" :style="{ height: `${(s.painAfter! / 10) * 100}%` }" />
            </div>
          </div>
          <p v-else class="hint">{{ T("noSessions") }}</p>
        </div>
        <div class="tile" :class="{ tap: inApp }">
          <NuxtLink v-if="inApp" :to="`${base}/calendar`" class="tap-cover" :aria-label="T('checkup')" />
          <span class="tile-label tap-label">{{ T("checkup") }} <ChevronRight v-if="inApp" class="ic" aria-hidden="true" /></span>
          <b>{{ fmt(`${p.plan.reviewDate}T09:00:00`, { weekday: "short", day: "numeric", month: "short" }) }}</b>
          <p v-if="openRequest" class="good-text">{{ T("requested") }}</p>
          <template v-else-if="asking">
            <input v-model="reason" :placeholder="T('askReason')" />
            <button class="primary pill-btn" @click="askCheckup">{{ T("send") }}</button>
          </template>
          <button v-else class="ghost pill-btn" @click="asking = true">{{ T("askCheckup") }}</button>
        </div>
        <div class="tile tap" :class="{ sun: otherFoot }">
          <button class="tap-cover" :aria-label="otherFoot ? T('otherFootTitle') : T('skin')" @click="emit('skin')" />
          <span class="tile-label tap-label" :style="otherFoot ? 'color: var(--warn-ink)' : ''"><Footprints v-if="otherFoot" class="ic" aria-hidden="true" /> {{ otherFoot ? T("otherFootTitle") : T("skin") }}</span>
          <p class="hint">{{ otherFoot ? T("otherFootHint") : T("skinHint") }}</p>
          <button class="ghost pill-btn" @click="emit('skin')">{{ T("skin") }} <ChevronRight class="ic" aria-hidden="true" /></button>
        </div>
        <nav v-if="inApp" class="tile wide more-list" :aria-label="T('journeyTitle')">
          <NuxtLink :to="`${base}/journey`" class="more-row"><Route class="ic" aria-hidden="true" /><b>{{ T("journeyRow", { n: journeyStep }) }}</b><ChevronRight class="ic chev" aria-hidden="true" /></NuxtLink>
          <NuxtLink :to="`${base}/questions`" class="more-row"><MessageCircleQuestion class="ic" aria-hidden="true" /><span class="more-text"><b>{{ T("questionsTitle") }}</b><span v-if="questionsWaiting" class="hint">{{ T("questionsWaitingN", { n: questionsWaiting }) }}</span></span><ChevronRight class="ic chev" aria-hidden="true" /></NuxtLink>
          <NuxtLink :to="`${base}/learn`" class="more-row"><BookOpen class="ic" aria-hidden="true" /><b>{{ T("learnTitle") }}</b><ChevronRight class="ic chev" aria-hidden="true" /></NuxtLink>
        </nav>
        <NuxtLink :to="`/patient/${p.id}/talk`" class="tile wide talk-tile">
          <span class="tile-label"><HeartHandshake class="ic" aria-hidden="true" /> {{ T("homeTalk") }}</span>
          <span class="hint">{{ T("homeTalkHint") }}</span>
          <ChevronRight class="ic talk-chev" aria-hidden="true" />
        </NuxtLink>
      </template>
    </div>

  </div>
  <UiSheet :open="sheet === 'plan'" :title="T('today')" @close="sheet = null">
    <div v-if="p" class="stack">
      <ul class="detail-list">
        <li v-for="item in p.plan.items" :key="item.exerciseId">
          <ExerciseVideoButton :exercise-id="item.exerciseId" :level="p.profile.level" />
          <NuxtLink :to="`/patient/${patientId}/exercise/${item.exerciseId}`" class="detail-main"><b>{{ exerciseById(item.exerciseId)?.name[lang] }}</b><span class="hint">{{ T("setsReps", { sets: item.sets, reps: item.reps }) }} · {{ T("howToDo") }} →</span></NuxtLink>
        </li>
      </ul>
      <p v-if="p.plan.note" class="note">“{{ p.plan.note }}”</p>
      <p class="hint">{{ T("planMeta", { v: p.plan.version, date: fmt(p.plan.updatedAt, { day: "numeric", month: "short" }), who: T(roleKey[p.plan.updatedBy]) }) }}</p>
      <button class="primary big-btn" @click="sheet = null; emit('start')">{{ T("start") }}</button>
    </div>
  </UiSheet>
  <UiSheet :open="sheet === 'pain'" :title="T('pain')" @close="sheet = null">
    <section v-if="p && painChart.length" class="pain-detail">
      <p v-if="painTrend" class="pain-say" :class="`trend-${painTrend.kind}`">{{ T(`painTrend_${painTrend.kind}` as TextKey, { a: painTrend.first, b: painTrend.last, limit: painTrend.limit }) }}</p>
      <div class="pain-chart" role="img" :aria-label="T('pain')">
        <span class="pain-limit" :style="{ bottom: `${(p.plan.painThreshold / 10) * 100}%` }"><span>{{ T("painLimitN", { n: p.plan.painThreshold }) }}</span></span>
        <div v-for="s in painChart" :key="s.id" class="pain-col">
          <div class="pain-pair">
            <i class="before" :style="{ height: `${((s.painBefore ?? 0) / 10) * 100}%` }"><b>{{ s.painBefore ?? "" }}</b></i>
            <i class="after" :class="{ high: s.painAfter !== null && s.painAfter >= p.plan.painThreshold }" :style="{ height: `${((s.painAfter ?? 0) / 10) * 100}%` }"><b>{{ s.painAfter ?? "" }}</b></i>
          </div>
          <span class="pain-day">{{ fmt(s.at, { day: "numeric" }) }}</span>
        </div>
      </div>
      <p class="pain-legend hint"><i class="before" /> {{ T("painBefore") }} <i class="after" /> {{ T("painAfterShort") }}</p>
    </section>
    <ul v-if="p" class="detail-list">
      <li v-for="s in painList" :key="s.id">
        <span class="detail-main">
          <b>{{ fmt(s.at, { weekday: "short", day: "numeric", month: "short" }) }}</b>
          <span class="hint">{{ T("pain") }}: {{ s.painBefore ?? "–" }} → <b :class="{ 'pain-high': s.painAfter !== null && s.painAfter >= p.plan.painThreshold }">{{ s.painAfter ?? "–" }}</b>/10</span>
        </span>
        <NuxtLink v-if="inApp" :to="`${base}/summary/${s.id}`" class="link">{{ T("open") }}</NuxtLink>
      </li>
    </ul>
  </UiSheet>
</template>

<style scoped>
.pain-detail { display: grid; gap: 10px; margin-bottom: 12px; }
.pain-say { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--sunken); font-weight: 600; }
.pain-say.trend-up, .pain-say.trend-over { background: var(--dawn-soft); }
.pain-say.trend-down { background: var(--pine-soft); }
.pain-chart { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; height: 160px; padding-top: 8px; border-bottom: 1px solid var(--line); }
.pain-limit { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--danger-ink); pointer-events: none; }
.pain-limit span { position: absolute; right: 0; top: -20px; font-size: 0.75rem; font-weight: 700; color: var(--danger-ink); background: var(--surface); padding: 0 4px; }
.pain-col { display: grid; grid-template-rows: 1fr auto; min-width: 0; }
.pain-pair { display: flex; gap: 2px; align-items: flex-end; justify-content: center; height: 100%; }
.pain-pair i, .pain-legend i { display: inline-block; width: 12px; border-radius: 3px 3px 0 0; }
.pain-pair i { position: relative; min-height: 2px; }
.pain-pair i b { position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%); font-size: 0.6875rem; font-style: normal; line-height: 1.4; color: var(--ink-2); }
.pain-pair .after b { color: var(--ink); }
.pain-pair .before, .pain-legend .before { background: var(--line-strong); }
.pain-pair .after, .pain-legend .after { background: var(--pine); }
.pain-pair .after.high { background: var(--danger-ink); }
.pain-day { font-size: 0.6875rem; color: var(--ink-3); text-align: center; }
.pain-legend { display: flex; gap: 6px; align-items: center; margin: 0; }
.pain-legend i { height: 10px; margin-left: 6px; }

.now-card { gap: 8px; }
.now-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.now-title { font: 700 1.25rem/1.3 var(--display); }
.now-start { margin-top: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.goal-of { color: var(--dawn-ink); }
.moment { margin-top: 6px; background: var(--dawn-soft); color: var(--dawn-ink); animation: pop var(--dur) var(--ease-out); }
.moment .ic { width: 14px; height: 14px; }
@keyframes pop { from { opacity: 0; transform: scale(0.9); } }
@media (prefers-reduced-motion: reduce) { .moment { animation: none; } }
/* Whole card is the tap target; buttons inside it sit above the cover. */
.tap { position: relative; isolation: isolate; cursor: pointer; transition: transform var(--dur-press) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
.tap:active { transform: scale(0.985); }
@media (hover: hover) { .tap:hover { box-shadow: var(--shadow-md); } }
.tap-cover { position: absolute; inset: 0; z-index: 0; border: 0; border-radius: inherit; background: none; cursor: pointer; }
.tap > :not(.tap-cover) { position: relative; z-index: 1; pointer-events: none; }
.tap > :not(.tap-cover) :is(a, button, input, .exercise-list li > *) { pointer-events: auto; }
.tap-label { display: inline-flex; align-items: center; gap: 4px; }
.tap-label .ic { width: 14px; height: 14px; }
.detail-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.detail-list li { display: flex; align-items: center; gap: 12px; }
.detail-main { display: grid; gap: 2px; flex: 1; min-width: 0; }
.pain-high { color: var(--danger-ink); }
.more-list { padding: 4px 6px; gap: 0; }
.more-row { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 10px; color: inherit; text-decoration: none; border-radius: 12px; transition: background-color var(--dur-fast) var(--ease-out); }
.more-row + .more-row { border-top: 1px solid var(--line); }
.more-row > .ic:first-child { flex: none; color: var(--pine); }
.more-row b, .more-text { flex: 1; min-width: 0; }
.more-text { display: grid; gap: 2px; }
.more-row:active { background: var(--sunken); }
.more-row .chev { flex: none; color: var(--ink-3); }
.talk-tile { position: relative; color: inherit; text-decoration: none; padding-right: 44px; }
.talk-chev { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--ink-3); }
</style>
