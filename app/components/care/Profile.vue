<script setup lang="ts">
import { Lock, Plus, Save, Trash2, TriangleAlert } from "lucide-vue-next";
import { exerciseById } from "#shared/exercises";
import { LEVEL_NAMES, MAX_LIMBS, elbowLost, kneeLost, levelsFor, limbsOf, type Limb, type LimbSite } from "#shared/limbs";
import { profileText, locale, type TextKey } from "#shared/i18n";
import { can } from "#shared/permissions";
import { CAUSES, STAGES, type CareRole, type Patient, type Plan, type Profile } from "#shared/model";

// Profile and clinical limits (DOK-02). Only the doctor edits; the physio reads. Limits live on the
// plan, so saving them makes a new plan version signed by the doctor.
const props = defineProps<{ patient: Patient; role: CareRole }>();
const emit = defineEmits<{ patch: [Partial<Patient>]; reload: [] }>();
const api = useApi(() => props.role);
const T = useT();
const lang = useLang();
const toast = useToast();
const canProfile = computed(() => can(props.role, "profile.edit"));
const canLimits = computed(() => can(props.role, "plan.limits"));

const blankProfile = (p: Profile) => ({ ...p, limbs: limbsOf(p).map((l) => ({ ...l })), comorbidities: p.comorbidities ?? "", surgeryDate: p.surgeryDate ?? "" });
const form = reactive(blankProfile(props.patient.profile));
watch(() => props.patient.profile, (p) => Object.assign(form, blankProfile(p)));
const profileDirty = computed(() => JSON.stringify(blankProfile(props.patient.profile)) !== JSON.stringify({ ...form }));

const limitsOf = (p: Plan) => ({ painThreshold: p.painThreshold, reviewDate: p.reviewDate, maxSets: p.maxSets ?? null, maxReps: p.maxReps ?? null });
const limits = reactive(limitsOf(props.patient.plan));
watch(() => props.patient.plan, (p) => Object.assign(limits, limitsOf(p)));
const limitsDirty = computed(() => JSON.stringify(limitsOf(props.patient.plan)) !== JSON.stringify({ ...limits, maxSets: limits.maxSets || null, maxReps: limits.maxReps || null }));

const busy = ref(false);
async function putProfile(body: Profile) {
  const saved = await api<Profile>(`/api/patients/${props.patient.id}/profile`, { method: "PUT", body });
  emit("patch", { profile: saved });
}
async function saveProfile() {
  const before = structuredClone(toRaw(props.patient.profile));
  busy.value = true;
  try {
    await putProfile({ ...form, surgeryDate: form.surgeryDate || null });
    toast.show(T("saved"), { tone: "good", undo: () => putProfile(before).catch((e) => toast.show(errorMessage(e), { tone: "bad" })) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    busy.value = false;
  }
}
async function putLimits(body: ReturnType<typeof limitsOf>) {
  const saved = await api<Plan>(`/api/patients/${props.patient.id}/plan`, { method: "PUT", body });
  emit("reload");
  return saved;
}
async function saveLimits() {
  const before = limitsOf(props.patient.plan);
  busy.value = true;
  try {
    const saved = await putLimits({ ...limits, maxSets: limits.maxSets || null, maxReps: limits.maxReps || null });
    toast.show(T("crSavedAs", { v: saved.version }), { tone: "good", undo: () => void putLimits(before).catch((e) => toast.show(errorMessage(e), { tone: "bad" })) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    busy.value = false;
  }
}
const day = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short", year: "numeric" }) : "–");

// Limbs (DAT-14): leg or arm, side and level; a site change resets the level to that site's default.
const usedBy = (site: LimbSite, side: Limb["side"], except: Limb) => form.limbs.some((o) => o !== except && o.site === site && o.side === side);
function setSite(l: Limb, site: LimbSite) {
  if (l.site === site) return;
  Object.assign(l, { site, level: site === "lower" ? "below_knee" : "below_elbow" });
}
function addLimb() {
  const free = (["lower", "upper"] as const).flatMap((site) => (["left", "right"] as const).map((side) => ({ site, side }))).find((c) => !form.limbs.some((l) => l.site === c.site && l.side === c.side));
  if (free) form.limbs.push({ ...free, level: free.site === "lower" ? "below_knee" : "below_elbow" });
}
// DOK-02: warn when the new level removes a joint that an exercise in the plan needs.
const jointWarnings = computed(() => {
  const plan = props.patient.plan.items.map((i) => exerciseById(i.exerciseId)).filter((e) => !!e);
  const knee = form.limbs.some(kneeLost) ? plan.filter((e) => e.needsKnee) : [];
  const elbow = form.limbs.some(elbowLost) ? plan.filter((e) => e.needsElbow) : [];
  return [
    ...(knee.length ? [T("kneeWarn", { names: knee.map((e) => e.name[lang.value]).join(", ") })] : []),
    ...(elbow.length ? [T("elbowWarn", { names: elbow.map((e) => e.name[lang.value]).join(", ") })] : []),
  ];
});
</script>

<template>
  <section class="cr-section">
    <!-- Profile -->
    <form class="card cr-item" @submit.prevent="saveProfile">
      <h2 class="cr-h">{{ T("crTab_profile") }}</h2>
      <template v-if="canProfile">
        <fieldset class="cr-limbs">
          <legend>{{ T("amputationLevel") }}</legend>
          <p v-if="!form.limbs.length" class="hint">{{ T("crLevel_none") }}</p>
          <div v-for="(l, n) in form.limbs" :key="n" class="cr-limb">
            <div class="seg seg-full" role="group" :aria-label="T('amputationLevel')">
              <button v-for="site in (['lower', 'upper'] as const)" :key="site" type="button" :class="{ on: l.site === site }" :aria-pressed="l.site === site" :disabled="l.site !== site && usedBy(site, l.side, l)" @click="setSite(l, site)">{{ T(site === "lower" ? "limbLeg" : "limbArm") }}</button>
            </div>
            <div class="seg seg-full" role="group" :aria-label="T('crSide')">
              <button v-for="s in (['left', 'right'] as const)" :key="s" type="button" :class="{ on: l.side === s }" class="cr-cap" :aria-pressed="l.side === s" :disabled="l.side !== s && usedBy(l.site, s, l)" @click="l.side = s">{{ T(s) }}</button>
            </div>
            <div class="cr-limb-row">
              <select v-model="l.level" :aria-label="T('limbLevel')"><option v-for="lv in levelsFor(l.site)" :key="lv" :value="lv">{{ LEVEL_NAMES[lv][lang] }}</option></select>
              <button type="button" class="ghost danger" :aria-label="T('remove')" @click="form.limbs.splice(n, 1)"><Trash2 class="ic" aria-hidden="true" /></button>
            </div>
          </div>
          <button v-if="form.limbs.length < MAX_LIMBS" type="button" class="ghost small-btn" @click="addLimb"><Plus class="ic" aria-hidden="true" /> {{ T("limbAdd") }}</button>
        </fieldset>
        <div v-for="w in jointWarnings" :key="w" class="cr-warn" role="alert">
          <TriangleAlert class="ic" aria-hidden="true" />
          <span>{{ w }} <NuxtLink :to="{ query: { ...$route.query, tab: 'plan' } }">{{ T("openPlan") }}</NuxtLink></span>
        </div>
        <div class="cr-form-grid">
          <label class="field"><span>{{ T("crStage") }}</span>
            <select v-model="form.stage"><option v-for="s in STAGES" :key="s" :value="s">{{ T(`crStage_${s}` as TextKey) }}</option></select>
          </label>
          <label class="field"><span>{{ T("crCause") }}</span>
            <select v-model="form.cause"><option v-for="c in CAUSES" :key="c" :value="c">{{ T(`crCause_${c}` as TextKey) }}</option></select>
          </label>
          <label class="field"><span>{{ T("crSurgery") }}</span><input v-model="form.surgeryDate" type="date" /></label>
        </div>
        <label class="field"><span>{{ T("crComorbid") }}</span><input v-model="form.comorbidities" maxlength="300" /></label>
        <label class="field"><span>{{ T("crRestrictions") }}</span><textarea v-model="form.restrictions" rows="2" maxlength="500" /></label>
        <div class="cr-actions">
          <button class="primary" :disabled="busy || !profileDirty"><Save class="ic" aria-hidden="true" /> {{ T("save") }}</button>
          <button v-if="profileDirty" type="button" class="ghost" @click="Object.assign(form, blankProfile(patient.profile))">{{ T("cancel") }}</button>
        </div>
      </template>
      <template v-else>
        <p>{{ profileText(lang, patient.profile) }}</p>
        <dl class="cr-dl">
          <div><dt>{{ T("crSurgery") }}</dt><dd>{{ day(patient.profile.surgeryDate) }}</dd></div>
          <div><dt>{{ T("crComorbid") }}</dt><dd>{{ patient.profile.comorbidities || "–" }}</dd></div>
        </dl>
        <p class="cr-lock"><Lock class="ic" aria-hidden="true" /> {{ T("setByDoctor") }}</p>
      </template>
    </form>

    <!-- Clinical limits -->
    <form class="card cr-item" @submit.prevent="saveLimits">
      <h2 class="cr-h">{{ T("crClinicalLimits") }}</h2>
      <template v-if="canLimits">
        <div class="cr-form-grid">
          <label class="field"><span>{{ T("painLimit") }} (1–10)</span><input v-model.number="limits.painThreshold" type="number" min="1" max="10" inputmode="numeric" required /></label>
          <label class="field"><span>{{ T("reviewDate") }}</span><input v-model="limits.reviewDate" type="date" required /></label>
          <label class="field"><span>{{ T("crMaxSets") }} (1–5)</span><input v-model.number="limits.maxSets" type="number" min="1" max="5" inputmode="numeric" placeholder="–" /></label>
          <label class="field"><span>{{ T("crMaxReps") }} (1–30)</span><input v-model.number="limits.maxReps" type="number" min="1" max="30" inputmode="numeric" placeholder="–" /></label>
        </div>
        <div class="cr-actions">
          <button class="primary" :disabled="busy || !limitsDirty"><Save class="ic" aria-hidden="true" /> {{ T("saveAs", { v: patient.plan.version + 1 }) }}</button>
          <button v-if="limitsDirty" type="button" class="ghost" @click="Object.assign(limits, limitsOf(patient.plan))">{{ T("cancel") }}</button>
        </div>
      </template>
      <template v-else>
        <dl class="cr-dl">
          <div><dt>{{ T("painLimit") }}</dt><dd>{{ patient.plan.painThreshold }}</dd></div>
          <div><dt>{{ T("reviewDate") }}</dt><dd>{{ day(patient.plan.reviewDate) }}</dd></div>
          <div><dt>{{ T("crMaxSets") }}</dt><dd>{{ patient.plan.maxSets ?? "–" }}</dd></div>
          <div><dt>{{ T("crMaxReps") }}</dt><dd>{{ patient.plan.maxReps ?? "–" }}</dd></div>
        </dl>
        <p class="cr-lock"><Lock class="ic" aria-hidden="true" /> {{ T("setByDoctor") }}</p>
      </template>
    </form>
  </section>
</template>

<style scoped>
.cr-form-grid { display: grid; gap: 10px; }
@media (min-width: 440px) { .cr-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.cr-cap { text-transform: capitalize; }
.cr-limbs { border: 0; margin: 0; padding: 0; display: grid; gap: 10px; min-width: 0; }
.cr-limbs legend { padding: 0; margin-bottom: 6px; font-weight: 700; }
.cr-limb { display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: var(--canvas); min-width: 0; }
.cr-limb-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.cr-limb-row select { width: 100%; min-width: 0; }
.cr-limbs > .small-btn { justify-self: start; }
.cr-warn { display: flex; gap: 8px; align-items: flex-start; padding: 12px; border-radius: 12px; background: var(--attention-soft); color: var(--attention-ink); }
.cr-warn .ic { flex: none; margin-top: 2px; }
.cr-warn a { color: inherit; font-weight: 700; }
.cr-form-grid .field, .cr-form-grid select, .cr-form-grid input { min-width: 0; }
.cr-dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
.cr-dl div { padding: 8px 10px; border-radius: 12px; background: var(--sunken); min-width: 0; }
.cr-dl dt { font-size: 0.75rem; color: var(--ink-2); }
.cr-dl dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
</style>
