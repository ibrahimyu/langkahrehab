<script setup lang="ts">
import { ArrowRight, Bell, FileText, CalendarDays, Check, CheckCircle2, ChevronRight, CircleDot, Heart, Info, ListChecks, PhoneCall, RotateCw, Volume2, VolumeX } from "lucide-vue-next";
import { weeklyNews, weeklyShare, textOf, byTaskOrder, reminderDue, returnSoon } from "#shared/family";
import { locale } from "#shared/i18n";
import { dayKey } from "#shared/calendar";
import type { TextKey } from "#shared/i18n";

// Family "Today" (KEL-02): in five seconds, how he is doing today, in everyday words. No AI on this
// card: the words come from rules. Below it, this week's news (KEL-04) and the jobs waiting for me.
const props = defineProps<{ patientId: string }>();
const T = useT();
const lang = useLang();
const dayText = useDayText();
const { view, me, send } = useFamily(props.patientId);
const reader = useReadAloud();
const v = computed(() => view.value!);

const status = computed(() => {
  const x = v.value;
  if (x.today.clinicNotified) return { tone: "notified", title: T("famClinicNotified") };
  if (x.today.exercised) return { tone: "done", title: T("famExercised", { name: x.name }) };
  return { tone: "open", title: T("famNotYet", { name: x.name }) };
});
const facts = computed(() => {
  const x = v.value;
  const out: string[] = [];
  if (x.today.exercised && x.today.pain && !x.today.clinicNotified) out.push(T("famPainAfter", { pain: T(`painWord_${x.today.pain}` as TextKey) }));
  if (x.nextVisit) out.push(T("famNextVisit", { date: dayText(x.nextVisit.date) + (x.nextVisit.time ? `, ${x.nextVisit.time}` : "") }));
  return out;
});
const spoken = computed(() => [status.value.title, ...facts.value].join(". "));

// Journey in short: the main goal and how many of its steps are done (read-only version of PAS-03).
const journeyOpen = ref(false);
const step = computed(() => {
  const g = v.value.goal;
  if (!g || !g.steps.length) return null;
  const done = g.steps.filter((s) => s.done).length;
  return { n: Math.min(done + 1, g.steps.length), total: g.steps.length };
});

// "Thank you" at most once a day per device.
const thanks = ref(false);
onMounted(() => {
  const key = `langkah-family-thanks:${props.patientId}`;
  try {
    const today = dayKey(Date.now());
    if (localStorage.getItem(key) !== today) {
      thanks.value = true;
      localStorage.setItem(key, today);
    }
  } catch {}
});

const mine = computed(() => v.value.tasks.filter((t) => t.assigneeId === me.value?.id && t.status === "open").sort(byTaskOrder));
// Reminders the person asked for, and borrowed items due back soon.
const reminders = computed(() => {
  const today = dayKey(Date.now());
  return v.value.tasks.filter((t) => t.assigneeId === me.value?.id && (reminderDue(t, today) || (t.status === "open" && returnSoon(t, today))));
});

// This week's news: the saved update (AI or care team), or the same facts from the template.
const news = computed(() => v.value.update?.text || weeklyNews(v.value.name, v.value.week, lang.value, dayText));
const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale(lang.value), { weekday: "short" });
const shareText = computed(() => weeklyShare(v.value.name, v.value.week, lang.value, dayText, dayName, news.value));
const refreshing = ref(false);
async function refresh() {
  refreshing.value = true;
  await send("/update", "POST", { lang: lang.value });
  refreshing.value = false;
}
</script>

<template>
  <section class="fam-today">
    <article class="card today-card" :class="`tone-${status.tone}`">
      <div class="today-head">
        <span class="today-ic" aria-hidden="true">
          <Info v-if="status.tone === 'notified'" class="ic" />
          <CheckCircle2 v-else-if="status.tone === 'done'" class="ic" />
          <CircleDot v-else class="ic" />
        </span>
        <h1>{{ status.title }}</h1>
      </div>
      <ul v-if="facts.length" class="today-facts">
        <li v-for="f in facts" :key="f">{{ f }}</li>
      </ul>
      <button v-if="reader.supported.value" class="ghost small-btn read-btn" @click="reader.toggle(spoken)">
        <component :is="reader.speaking.value ? VolumeX : Volume2" class="ic" aria-hidden="true" /> {{ reader.speaking.value ? T("stopReading") : T("readAloud") }}
      </button>
    </article>

    <button v-if="step && v.goal" class="card journey" @click="journeyOpen = true">
      <span class="journey-text">
        <span class="hint">{{ T("famStepOf", step) }} · {{ T("famJourney") }}</span>
        <b>{{ v.goal.text }}</b>
      </span>
      <span class="journey-ticks" aria-hidden="true"><i v-for="(s, i) in v.goal.steps" :key="i" :class="{ on: s.done }" /></span>
      <ChevronRight class="ic chev" aria-hidden="true" />
    </button>

    <p v-if="thanks" class="thanks"><Heart class="ic" aria-hidden="true" /> {{ T("famThanks", { name: v.name }) }}</p>

    <NuxtLink v-if="reminders.length" :to="`/family/${patientId}/tasks`" class="card remind-card">
      <span class="my-tasks-ic" aria-hidden="true"><Bell class="ic" /></span>
      <span class="my-tasks-text">
        <b>{{ T("remToday") }}</b>
        <span v-for="t in reminders" :key="t.id" class="hint">{{ t.sourcing?.status === "borrowed" && t.sourcing.returnBy ? T("navReturnSoon", { item: textOf(t.title, lang), from: t.sourcing.from || "—", date: dayText(t.sourcing.returnBy) }) : textOf(t.title, lang) }}<template v-if="t.reminder"> · {{ t.reminder.time }}</template></span>
      </span>
      <ArrowRight class="ic chev" aria-hidden="true" />
    </NuxtLink>

    <NuxtLink v-if="v.letterExplanation" :to="`/family/${patientId}/letter`" class="card my-tasks">
      <span class="my-tasks-ic" aria-hidden="true"><FileText class="ic" /></span>
      <span class="my-tasks-text"><b>{{ T("letTitleFam") }}</b><span class="hint">{{ v.letterExplanation.what }}</span></span>
      <ArrowRight class="ic chev" aria-hidden="true" />
    </NuxtLink>

    <NuxtLink :to="`/family/${patientId}/tasks`" class="card my-tasks">
      <span class="my-tasks-ic" aria-hidden="true"><ListChecks class="ic" /></span>
      <span class="my-tasks-text">
        <b>{{ T("famMyTasks") }}</b>
        <span class="hint">{{ mine.length ? textOf(mine[0]!.title, lang) : T("famAllDone") }}</span>
      </span>
      <span v-if="mine.length" class="pill">{{ T("famTasksLeft", { n: mine.length }) }}</span>
      <ArrowRight class="ic chev" aria-hidden="true" />
    </NuxtLink>

    <article class="card stack week">
      <header class="week-head">
        <h2><CalendarDays class="ic" aria-hidden="true" /> {{ T("famThisWeek") }}</h2>
        <button class="ghost small-btn" :disabled="refreshing" @click="refresh"><RotateCw class="ic" :class="{ spin: refreshing }" aria-hidden="true" /> {{ T("famNewsRefresh") }}</button>
      </header>
      <!-- The week in numbers, then the words -->
      <ol v-if="v.week.dayList" class="week-days" :aria-label="T('famNewsDays', { name: v.name, n: v.week.days })">
        <li v-for="d in v.week.dayList" :key="d.date" :class="{ done: d.done }">
          <span class="week-dot" aria-hidden="true"><Check v-if="d.done" class="ic" /></span>
          <span class="week-day">{{ dayName(d.date) }}</span>
        </li>
      </ol>
      <dl class="week-stats">
        <div><dt>{{ T("famStatDays") }}</dt><dd>{{ v.week.days }}/7</dd></div>
        <div><dt>{{ T("famStatReps") }}</dt><dd>{{ v.week.reps ?? 0 }}</dd></div>
        <div><dt>{{ T("famStatPain") }}</dt><dd>{{ v.week.pain ? T(`painWord_${v.week.pain}` as TextKey) : "–" }}<small v-if="v.week.painTrend"> · {{ T(`famTrend_${v.week.painTrend}` as TextKey) }}</small></dd></div>
        <div><dt>{{ T("famStatTasks") }}</dt><dd>{{ v.week.tasksDone ?? 0 }}</dd></div>
      </dl>
      <p class="week-text">{{ news }}</p>
      <div class="controls">
        <FamilyShare :text="shareText" small />
      </div>
    </article>

    <article v-if="v.pain?.length" class="card stack">
      <h2 class="pain-h">{{ T("pain") }}</h2>
      <PainChart :points="v.pain" :limit="v.painLimit" family />
    </article>

    <NuxtLink :to="`/family/${patientId}/help`" class="link with-ic when-link"><PhoneCall class="ic" aria-hidden="true" /> {{ T("famWhenToCall") }}</NuxtLink>

    <UiSheet v-if="v.goal" :open="journeyOpen" :title="v.goal.text" @close="journeyOpen = false">
      <ol class="steps-list">
        <li v-for="(s, i) in v.goal.steps" :key="i" :class="{ done: s.done }">
          <span class="step-dot" aria-hidden="true"><CheckCircle2 v-if="s.done" class="ic" /><span v-else>{{ i + 1 }}</span></span>
          <span>{{ s.text }}</span>
        </li>
      </ol>
    </UiSheet>
  </section>
</template>

<style scoped>
.pain-h { font-size: 1.125rem; }
.remind-card { display: flex; gap: 12px; align-items: center; color: var(--ink); text-decoration: none; border: 1px solid var(--dawn); background: color-mix(in srgb, var(--dawn-soft) 55%, var(--surface)); }
.fam-today { display: grid; gap: 14px; }
.today-card { display: grid; gap: 10px; padding: 20px; }
.today-head { display: flex; gap: 12px; align-items: flex-start; }
.today-head h1 { font-size: clamp(1.375rem, 6vw, 1.75rem); line-height: 1.2; }
.today-ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; flex: none; }
.today-ic .ic { width: 26px; height: 26px; }
.tone-done .today-ic { background: var(--good-soft); color: var(--good-ink); }
.tone-open .today-ic { background: var(--sunken); color: var(--ink-2); }
.tone-notified { background: var(--info-soft); box-shadow: none; }
.tone-notified .today-ic { background: var(--surface); color: var(--info-ink); }
.today-facts { list-style: none; margin: 0; padding: 0 0 0 56px; display: grid; gap: 4px; color: var(--ink-2); font-size: 1.0625rem; }
.read-btn { justify-self: start; margin-left: 48px; }
.journey { display: flex; align-items: center; gap: 12px; text-align: left; border: 1px solid var(--line); color: var(--ink); cursor: pointer; width: 100%; transition: transform var(--dur-press) var(--ease-out); }
.journey:active { transform: scale(0.98); }
.journey-text { display: grid; gap: 2px; min-width: 0; flex: 1; }
.journey-ticks { display: flex; gap: 3px; flex: none; }
.journey-ticks i { width: 6px; height: 20px; border-radius: var(--r-pill); background: var(--line); }
.journey-ticks i.on { background: var(--dawn); }
.chev { color: var(--ink-3); flex: none; }
.thanks { display: flex; align-items: center; gap: 8px; color: var(--dawn-ink); font-weight: 600; }
.thanks .ic { flex: none; }
.my-tasks { display: flex; align-items: center; gap: 12px; color: var(--ink); text-decoration: none; transition: transform var(--dur-press) var(--ease-out); }
.my-tasks:active { transform: scale(0.98); }
.my-tasks-ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--dawn-soft); color: var(--dawn-ink); flex: none; }
.my-tasks-text { display: grid; gap: 2px; min-width: 0; flex: 1; }
.my-tasks-text .hint { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.week-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.week-head h2 { display: inline-flex; align-items: center; gap: 8px; font-size: 1.125rem; }
.week-text { font-size: 1rem; line-height: 1.55; }
.week-days { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.week-days li { display: grid; justify-items: center; gap: 4px; }
.week-dot { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--sunken); color: var(--surface); }
.week-dot .ic { width: 16px; height: 16px; }
.week-days .done .week-dot { background: var(--pine); }
.week-day { font-size: 0.75rem; color: var(--ink-3); }
.week-stats { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.week-stats div { padding: 10px 12px; border-radius: 12px; background: var(--sunken); }
.week-stats dt { font-size: 0.8125rem; color: var(--ink-2); }
.week-stats dd { margin: 0; font: 700 1.25rem/1.2 var(--display); }
.week-stats small { font: 600 0.8125rem var(--body, inherit); color: var(--ink-2); }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
.when-link { justify-self: start; min-height: 44px; }
.steps-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.steps-list li { display: flex; gap: 12px; align-items: flex-start; }
.steps-list li.done { color: var(--ink-2); }
.step-dot { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--sunken); font-weight: 700; font-size: 0.875rem; flex: none; }
.steps-list li.done .step-dot { background: var(--good-soft); color: var(--good-ink); }
</style>
