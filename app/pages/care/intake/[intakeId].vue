<script setup lang="ts">
import { ArrowLeft, CalendarCheck, Check, ChevronRight, CircleAlert, ClipboardList, FileText, Pill, Plus, Save, Sparkles, Trash2, UserPlus, UserRound, Users } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";
import { CONFIDENT, INTAKE_FIELDS, INTAKE_LEVELS, SEXES, SIDES, missingRequired, type Intake, type IntakeField, type IntakeResult } from "#shared/intake";
import { LEVEL_NAMES, type LimbLevel } from "#shared/limbs";
import { CAUSES, FAMILY_RELATIONS } from "#shared/model";

// DOK-01 review: every field the AI read, with the ones it was unsure of marked, the medicines copied
// for the team, family members and family tasks from the letter's advice. Nothing reaches the patient
// until the doctor confirms.
const route = useRoute();
const id = route.params.intakeId as string;
const api = useApi("doctor");
const T = useT();
const lang = useLang();
const toast = useToast();

const intake = ref<Intake | null>(null);
const letter = ref<{ image: string; pages: string[]; by: string | null; patientName: string } | null>(null);
const loadError = ref("");
const values = reactive<Record<IntakeField, string | number | null>>(Object.fromEntries(INTAKE_FIELDS.map((f) => [f, null])) as Record<IntakeField, string | number | null>);
const family = ref<{ name: string; relation: (typeof FAMILY_RELATIONS)[number]; livesWithPatient: boolean }[]>([]);
const tasks = ref<{ title: string; detail: string; item: boolean; selected: boolean }[]>([]);
// The explanation for the patient and family; lists are edited one point per line.
const explain = reactive({ what: "", homeCare: "", warningSigns: "", visits: "" });
const toLines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
const images = useLetterImages();
const photos = computed(() => (letter.value?.pages ?? (images.value[id] ? [images.value[id]] : [])).filter((x) => x.startsWith("data:image")));
const pdfPages = computed(() => (letter.value?.pages ?? []).filter((x) => x.startsWith("data:application/pdf")).length);

async function load() {
  loadError.value = "";
  try {
    const r = await api<{ intake: Intake; letter: typeof letter.value }>(`/api/intake/${id}`);
    intake.value = r.intake;
    letter.value = r.letter;
    for (const f of INTAKE_FIELDS) values[f] = r.intake.fields[f].value;
    family.value = r.intake.family.map((m) => ({ ...m }));
    tasks.value = (r.intake.suggestedTasks ?? []).map((x) => ({ ...x }));
    const e = r.intake.explanation;
    Object.assign(explain, { what: e?.what ?? "", homeCare: (e?.homeCare ?? []).join("\n"), warningSigns: (e?.warningSigns ?? []).join("\n"), visits: (e?.visits ?? []).join("\n") });
  } catch (e) {
    loadError.value = errorMessage(e);
  }
}
onMounted(load);

const edited = (f: IntakeField) => intake.value && values[f] !== intake.value.fields[f].value;
const unsure = (f: IntakeField) => !!intake.value && !edited(f) && (values[f] === null || values[f] === "" || intake.value.fields[f].confidence < CONFIDENT);
const missing = computed(() => {
  if (!intake.value) return [];
  const fields = Object.fromEntries(INTAKE_FIELDS.map((f) => [f, { value: values[f] === "" ? null : values[f], confidence: 1, edited: true }])) as Intake["fields"];
  return missingRequired(fields);
});
const levelName = (l: string) => (l === "other" ? T("ikNotRead") : LEVEL_NAMES[l as LimbLevel][lang.value]);
const body = () => ({
  values: Object.fromEntries(INTAKE_FIELDS.map((f) => [f, values[f] === "" ? null : values[f]])),
  family: family.value.filter((m) => m.name.trim()),
  tasks: tasks.value,
  explanation: { what: explain.what, homeCare: toLines(explain.homeCare), warningSigns: toLines(explain.warningSigns), visits: toLines(explain.visits) },
});

const busy = ref(false);
async function saveDraft() {
  busy.value = true;
  try {
    intake.value = (await api<{ intake: Intake }>(`/api/intake/${id}`, { method: "PUT", body: body() })).intake;
    toast.show(T("saved"), { tone: "good", ms: 1800 });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    busy.value = false;
  }
}
const result = ref<IntakeResult | null>(null);
async function confirm() {
  busy.value = true;
  try {
    result.value = (await api<{ result: IntakeResult }>(`/api/intake/${id}/confirm`, { method: "POST", body: body() })).result;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    busy.value = false;
  }
}
const discarding = ref(false);
async function discard() {
  discarding.value = false;
  try {
    await api(`/api/intake/${id}`, { method: "DELETE" });
    await navigateTo("/care");
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}
const dateText = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(lang.value === "zh" ? "zh-CN" : lang.value === "id" ? "id-ID" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
</script>

<template>
  <div class="care-page ik-page">
    <NuxtLink to="/care" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("patients") }}</NuxtLink>
    <p v-if="loadError" class="error">{{ loadError }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>
    <div v-else-if="!intake" class="card ik-loading" aria-busy="true" />

    <!-- Confirmed -->
    <section v-else-if="result" class="card ik-done">
      <span class="ik-done-ic"><Check class="ic" aria-hidden="true" /></span>
      <h1>{{ T("ikDone", { name: String(values.patientName ?? "") }) }}</h1>
      <p class="cr-meta">{{ T("ikMade") }}</p>
      <ul class="ik-made">
        <li><NuxtLink :to="`/care/${result.patientId}?tab=profile`" class="ik-made-row"><UserRound class="ic" aria-hidden="true" /> <span>{{ T("ikMadeProfile") }}</span><ChevronRight class="ic go" aria-hidden="true" /></NuxtLink></li>
        <li><NuxtLink :to="`/care/${result.patientId}?tab=plan#plan-v${result.planVersion}`" class="ik-made-row"><ClipboardList class="ic" aria-hidden="true" /> <span>{{ T("ikLinkPlan", { v: result.planVersion }) }}</span><ChevronRight class="ic go" aria-hidden="true" /></NuxtLink></li>
        <li><NuxtLink :to="`/care/${result.patientId}?tab=family#family-tasks`" class="ik-made-row"><Users class="ic" aria-hidden="true" /> <span>{{ T("ikLinkFamily", { n: result.tasks }) }}</span><ChevronRight class="ic go" aria-hidden="true" /></NuxtLink></li>
        <li v-if="result.checkIn"><NuxtLink :to="`/care/${result.patientId}`" class="ik-made-row"><CalendarCheck class="ic" aria-hidden="true" /> <span>{{ T("ikLinkVisit", { date: dateText(result.checkIn) }) }}</span><ChevronRight class="ic go" aria-hidden="true" /></NuxtLink></li>
      </ul>
      <NuxtLink :to="`/care/${result.patientId}`" class="primary big-btn">{{ T("ikOpenPatient") }}</NuxtLink>
    </section>

    <template v-else>
      <header class="care-head">
        <p class="eyebrow">{{ T("careTeam") }} · {{ T("roleDoctor") }}</p>
        <h1>{{ T("ikCheckTitle") }}</h1>
        <p class="ik-by" :class="`by-${intake.readBy}`">
          <Sparkles v-if="intake.readBy === 'ai'" class="ic" aria-hidden="true" /><CircleAlert v-else class="ic" aria-hidden="true" />
          {{ intake.readBy === "ai" ? T("ikReadByAi") : intake.readBy === "sample" ? T("ikReadBySample") : T("ikReadManual") }}
        </p>
      </header>

      <figure v-if="photos.length || pdfPages" class="ik-photo">
        <img v-for="(src, i) in photos" :key="i" :src="src" alt="" />
        <span v-if="pdfPages" class="pill"><FileText class="ic" aria-hidden="true" /> PDF · {{ pdfPages }}</span>
        <figcaption v-if="letter?.by" class="cr-meta">{{ T("ikLetterFrom", { name: letter.by }) }}</figcaption>
      </figure>

      <section class="card ik-fields">
        <div v-for="f in INTAKE_FIELDS" :key="f" class="ik-field" :class="{ unsure: unsure(f) }">
          <label :for="`ik-${f}`">
            {{ T(`ikField_${f}` as TextKey) }}
            <span v-if="unsure(f)" class="pill ik-check"><CircleAlert class="ic" aria-hidden="true" /> {{ T("ikCheck") }}</span>
            <span v-else-if="edited(f)" class="pill">{{ T("ikEdited") }}</span>
          </label>
          <select v-if="f === 'sex'" :id="`ik-${f}`" v-model="values[f]"><option :value="null">–</option><option v-for="x in SEXES" :key="x" :value="x">{{ T(`sex_${x}` as TextKey) }}</option></select>
          <select v-else-if="f === 'amputationSide'" :id="`ik-${f}`" v-model="values[f]"><option :value="null">–</option><option v-for="x in SIDES" :key="x" :value="x">{{ T(x) }}</option></select>
          <select v-else-if="f === 'amputationLevel'" :id="`ik-${f}`" v-model="values[f]"><option :value="null">–</option><option v-for="x in INTAKE_LEVELS" :key="x" :value="x">{{ levelName(x) }}</option></select>
          <select v-else-if="f === 'cause'" :id="`ik-${f}`" v-model="values[f]"><option :value="null">–</option><option v-for="x in CAUSES" :key="x" :value="x">{{ T(`crCause_${x}` as TextKey) }}</option></select>
          <input v-else-if="f === 'age'" :id="`ik-${f}`" v-model.number="values[f]" type="number" min="1" max="110" inputmode="numeric" />
          <input v-else-if="f === 'surgeryDate' || f === 'nextVisitDate'" :id="`ik-${f}`" v-model="values[f]" type="date" />
          <textarea v-else-if="f === 'restrictions' || f === 'comorbidities'" :id="`ik-${f}`" v-model="values[f] as string" rows="3" />
          <input v-else :id="`ik-${f}`" v-model="values[f]" type="text" />
        </div>
      </section>

      <section v-if="intake.medicationsMentioned.length" class="card ik-meds">
        <h2 class="cr-h"><Pill class="ic" aria-hidden="true" /> {{ T("ikMeds") }}</h2>
        <ul><li v-for="(m, i) in intake.medicationsMentioned" :key="i">{{ m }}</li></ul>
        <p class="cr-meta">{{ T("ikMedsNote") }}</p>
      </section>

      <section class="card ik-explain">
        <h2 class="cr-h"><Sparkles class="ic" aria-hidden="true" /> {{ T("ikExplain") }}</h2>
        <p class="cr-meta">{{ T("ikExplainNote") }}</p>
        <label class="field"><span>{{ T("letWhat") }}</span><textarea v-model="explain.what" rows="3" maxlength="600" /></label>
        <label class="field"><span>{{ T("letHome") }} · <span class="cr-meta">{{ T("ikExplainOneLine") }}</span></span><textarea v-model="explain.homeCare" rows="4" /></label>
        <label class="field"><span>{{ T("letWarn") }} · <span class="cr-meta">{{ T("ikExplainOneLine") }}</span></span><textarea v-model="explain.warningSigns" rows="4" /></label>
        <label class="field"><span>{{ T("letVisits") }} · <span class="cr-meta">{{ T("ikExplainOneLine") }}</span></span><textarea v-model="explain.visits" rows="3" /></label>
      </section>

      <section class="card ik-tasks">
        <h2 class="cr-h"><FileText class="ic" aria-hidden="true" /> {{ T("ikTasks") }}</h2>
        <p v-if="!tasks.length" class="cr-meta">{{ T("ikNotRead") }}</p>
        <label v-for="(x, i) in tasks" :key="i" class="ik-task" :class="{ off: !x.selected }">
          <input v-model="x.selected" type="checkbox" />
          <span><textarea v-model="x.title" class="ik-task-title" rows="1" maxlength="120" :aria-label="T('famTaskTitle')" @keydown.enter.prevent /><span class="cr-meta">{{ x.detail }}</span></span>
        </label>
        <p v-if="tasks.length" class="cr-meta">{{ T("ikTasksNote") }}</p>
      </section>

      <section class="card ik-family">
        <h2 class="cr-h"><UserPlus class="ic" aria-hidden="true" /> {{ T("ikFamily") }}</h2>
        <div v-for="(m, i) in family" :key="i" class="ik-member">
          <input v-model="m.name" maxlength="40" :placeholder="T('admName')" :aria-label="T('admName')" />
          <select v-model="m.relation"><option v-for="r in FAMILY_RELATIONS" :key="r" :value="r">{{ T(`rel_${r}` as TextKey) }}</option></select>
          <label class="check inline"><input v-model="m.livesWithPatient" type="checkbox" /> {{ T("admLivesWith") }}</label>
          <button class="ghost small-btn" :aria-label="T('admRemove')" @click="family.splice(i, 1)"><Trash2 class="ic" aria-hidden="true" /></button>
        </div>
        <button class="link" @click="family.push({ name: '', relation: 'spouse', livesWithPatient: true })"><Plus class="ic" aria-hidden="true" /> {{ T("ikAddFamily") }}</button>
      </section>

      <p v-if="missing.length" class="error">{{ T("ikMissing", { fields: missing.map((f) => T(`ikField_${f}` as TextKey)).join(", ") }) }}</p>
      <div class="ik-actions">
        <button class="primary big-btn" :disabled="busy || missing.length > 0" @click="confirm"><Check class="ic" aria-hidden="true" /> {{ intake.patientId ? T("ikConfirmUpdate") : T("ikConfirmNew") }}</button>
        <button class="ghost big-btn" :disabled="busy" @click="saveDraft"><Save class="ic" aria-hidden="true" /> {{ T("ikSaveDraft") }}</button>
        <button class="ghost danger big-btn" :disabled="busy" @click="discarding = true"><Trash2 class="ic" aria-hidden="true" /> {{ T("ikDiscard") }}</button>
      </div>
      <UiConfirmDialog :open="discarding" :title="T('ikDiscard')" :body="T('ikDiscardBody')" :confirm-label="T('ikDiscard')" danger @confirm="discard" @cancel="discarding = false" />
    </template>
  </div>
</template>

<style scoped>
.ik-page { max-width: 640px; margin: 0 auto; display: grid; gap: 14px; }
.ik-loading { min-height: 300px; }
.ik-by { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--pine-soft); }
.ik-by.by-sample, .ik-by.by-manual { background: var(--dawn-soft); }
.ik-by .ic { flex: none; margin-top: 3px; }
.ik-photo { margin: 0; display: grid; gap: 6px; }
.ik-photo img { width: 100%; max-height: 420px; object-fit: contain; border-radius: 12px; background: var(--sunken); }
.ik-fields { display: grid; gap: 12px; }
.ik-field { display: grid; gap: 6px; }
.ik-field label { display: flex; gap: 8px; align-items: center; font-weight: 600; font-size: 0.9375rem; }
.ik-field input, .ik-field select, .ik-field textarea { width: 100%; min-width: 0; }
.ik-field.unsure input, .ik-field.unsure select, .ik-field.unsure textarea { border-color: var(--dawn); background: color-mix(in srgb, var(--dawn-soft) 50%, var(--surface)); }
.ik-check { background: var(--dawn-soft); color: var(--ink); }
.ik-meds ul { margin: 0; padding-left: 1.2em; display: grid; gap: 4px; }
.ik-tasks, .ik-family, .ik-meds, .ik-explain { display: grid; gap: 10px; }
.ik-explain textarea { width: 100%; }
.ik-task { display: flex; gap: 10px; align-items: flex-start; padding: 10px; border-radius: 12px; background: var(--sunken); cursor: pointer; }
.ik-task.off { opacity: 0.6; }
.ik-task > input { width: 22px; height: 22px; flex: none; margin: 4px 0 0; }
.ik-task > span { display: grid; gap: 2px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ik-task-title { width: 100%; min-width: 0; min-height: 32px; font-weight: 600; line-height: 1.4; background: transparent; border: 0; padding: 2px 0; resize: none; field-sizing: content; }
.ik-member { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 10px; border-radius: 12px; background: var(--sunken); }
.ik-member > input { grid-column: 1 / -1; }
.ik-actions { display: grid; gap: 8px; }
.ik-done { display: grid; gap: 12px; justify-items: start; }
.ik-done-ic { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: var(--pine); color: var(--surface); }
.ik-done h1 { margin: 0; }
.ik-done > p { margin: 0; }
.ik-made { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; width: 100%; }
.ik-made-row { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 12px 14px; border-radius: 14px; background: var(--canvas); color: var(--ink); text-decoration: none; font-weight: 600; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.ik-made-row:hover { background: var(--pine-soft); }
.ik-made-row:active { transform: scale(0.99); }
.ik-made-row > span { flex: 1; min-width: 0; }
.ik-made-row .ic { flex: none; color: var(--pine); }
.ik-made-row .go { color: var(--ink-3); }
</style>
