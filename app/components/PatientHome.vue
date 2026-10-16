<script setup lang="ts">
import { exerciseById } from "#shared/exercises";
import { ago, locale, profileText, stories, type TextKey } from "#shared/i18n";
import { DAY, type Patient } from "#shared/model";
import { daysSinceSession, weekAdherence } from "#shared/rules";

// The patient's home screen. "meet" introduces the patient (photo, X-ray, goal) for a scenario;
// "home" is the everyday screen with progress, check-ups and the skin check.
const props = defineProps<{ patientId: string; variant: "meet" | "home" }>();
const emit = defineEmits<{ start: []; skin: [] }>();

const api = useApi();
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
  return { text: T(`next_${s.nextAction.kind}` as TextKey), danger: s.nextAction.kind === "stop_contact" || s.nextAction.kind === "rest_contact" };
});
const sinceLast = computed(() => (p.value ? daysSinceSession(p.value, now.value) : null));
const newPlan = computed(() => !!p.value && p.value.plan.version > 1 && now.value - Date.parse(p.value.plan.updatedAt) < 2 * DAY);
const adherence = computed(() => (p.value ? weekAdherence(p.value, now.value) : null));
const painSeries = computed(() => (p.value?.sessions ?? []).filter((s) => s.painAfter !== null).slice(-7));
const fmt = (d: string | number, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString(locale(lang.value), o);
const sideWord = computed(() => (p.value ? T(p.value.profile.side) : ""));
const profileLine = computed(() => {
  const pr = p.value?.profile;
  if (!pr || pr.level === "none") return "";
  const level = pr.level === "below_knee" ? { en: "below the knee", id: "di bawah lutut", zh: "膝下" } : { en: "above the knee", id: "di atas lutut", zh: "膝上" };
  const text = { en: `${sideWord.value} leg, ${level.en}`, id: `kaki ${sideWord.value}, ${level.id}`, zh: `${sideWord.value}腿${level.zh}` }[lang.value];
  return text.charAt(0).toUpperCase() + text.slice(1);
});

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
  <div v-if="p" class="patient-view">
    <div class="greet">
      <MediaFrame class="avatar" :src="`/media/patients/${p.id}.jpg`" :label="p.name" icon="◯" />
      <div>
        <h1>{{ T("hello", { name: p.name }) }}</h1>
        <p class="hint">{{ fmt(now, { weekday: "long", day: "numeric", month: "long" }) }}</p>
      </div>
    </div>

    <div class="bento">
      <!-- Advice, nudge or new plan comes first: it's what the patient needs to act on. -->
      <div v-if="advice" class="tile wide" :class="advice.danger ? 'danger' : 'sun'"><b>{{ advice.text }}</b></div>
      <div v-else-if="sinceLast !== null && sinceLast >= 2" class="tile wide sun"><b>{{ T("missedNudge", { n: sinceLast }) }}</b></div>
      <div v-if="newPlan && variant === 'home'" class="tile wide sky">
        <span class="tile-label">✦ {{ T("newPlan") }}</span>
        <p v-if="p.plan.note">“{{ p.plan.note }}”</p>
      </div>

      <template v-if="variant === 'meet'">
        <div class="tile wide"><p>{{ stories[p.id]?.[lang] ?? p.story }}</p></div>
        <MediaFrame v-if="p.profile.level !== 'none'" :src="`/media/xray/${p.id}.png`" :label="T('amputationLevel')" style="aspect-ratio: 3 / 4; border-radius: 22px">
          <template #fallback><LimbDiagram :profile="p.profile" :label="T('amputationLevel')" /></template>
        </MediaFrame>
        <div class="tile" :class="{ wide: p.profile.level === 'none' }">
          <span class="tile-label">{{ T("amputationLevel") }}</span>
          <b>{{ profileLine || profileText(lang, p.profile) }}</b>
          <p v-if="p.profile.restrictions" class="hint">{{ p.profile.restrictions }}</p>
          <template v-if="goal">
            <span class="tile-label" style="margin-top: 6px">{{ T("goal") }}</span>
            <p class="goal">★ {{ goal }}</p>
          </template>
        </div>
      </template>

      <div v-else class="tile wide navy">
        <div class="ring-row">
          <ProgressRing :value="adherence ?? 0" />
          <div>
            <div class="tile-big" style="color: #fff">{{ adherence ?? 0 }}%</div>
            <p style="color: #c9daea">{{ T("thisWeek") }}</p>
            <p style="color: #c9daea; font-size: 13px">{{ T("last") }}: {{ sinceLast === null ? T("noSessions") : ago(lang, sinceLast) }}</p>
          </div>
        </div>
      </div>

      <div class="tile wide">
        <span class="tile-label">{{ T("today") }}</span>
        <ul class="exercise-list">
          <li v-for="item in p.plan.items" :key="item.exerciseId">
            <MediaFrame class="thumb" kind="video" :src="`/media/exercises/${item.exerciseId}.mp4`" :poster="`/media/exercises/${item.exerciseId}.jpg`" :label="T('video')" />
            <b>{{ exerciseById(item.exerciseId)?.name[lang] }}</b>
            <span class="dose">{{ T("setsReps", { sets: item.sets, reps: item.reps }) }}</span>
          </li>
        </ul>
        <p v-if="p.plan.note && !(newPlan && variant === 'home')" class="hint">{{ T("note") }}: “{{ p.plan.note }}”</p>
      </div>

      <template v-if="variant === 'home'">
        <div v-if="goal" class="tile sun">
          <span class="tile-label" style="color: var(--warn-ink)">{{ T("goal") }}</span>
          <b>★ {{ goal }}</b>
        </div>
        <div class="tile sky" :class="{ wide: !goal }">
          <span class="tile-label">{{ T("pain") }}</span>
          <div v-if="painSeries.length" class="bars" style="height: 56px">
            <div v-for="s in painSeries" :key="s.id" class="bar-col" :title="`${s.at.slice(0, 10)}: ${s.painAfter}/10`">
              <div class="bar-fill" :class="{ high: s.painAfter! >= p.plan.painThreshold }" :style="{ height: `${(s.painAfter! / 10) * 100}%` }" />
            </div>
          </div>
          <p v-else class="hint">{{ T("noSessions") }}</p>
        </div>
        <div class="tile">
          <span class="tile-label">{{ T("checkup") }}</span>
          <b>{{ fmt(`${p.plan.reviewDate}T09:00:00`, { weekday: "short", day: "numeric", month: "short" }) }}</b>
          <p v-if="openRequest" class="good-text" style="font-size: 13px">{{ T("requested") }}</p>
          <template v-else-if="asking">
            <input v-model="reason" :placeholder="T('askReason')" />
            <button class="primary pill-btn" @click="askCheckup">{{ T("send") }}</button>
          </template>
          <button v-else class="ghost pill-btn" @click="asking = true">{{ T("askCheckup") }}</button>
        </div>
        <div class="tile">
          <span class="tile-label">{{ T("skin") }}</span>
          <p class="hint" style="font-size: 13px">{{ T("skinHint") }}</p>
          <button class="ghost pill-btn" @click="emit('skin')">{{ T("skin") }} →</button>
        </div>
      </template>
    </div>

    <div class="cta">
      <button class="primary big-btn pill-btn" @click="emit('start')">{{ T("start") }}</button>
      <p class="hint" style="text-align: center; margin-top: 6px">{{ T("startHint") }}</p>
    </div>
  </div>
</template>
