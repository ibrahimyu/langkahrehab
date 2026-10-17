<script setup lang="ts">
import type { Component } from "vue";
import { ChevronRight, HeartPulse, Plus, Save, ShieldCheck, Stethoscope, Trash2, UserPlus, UserRound, Users } from "lucide-vue-next";
import type { Account } from "#shared/accounts";
import { LANG_NAMES, LANGS } from "#shared/exercises";
import type { TextKey } from "#shared/i18n";
import { LEVEL_NAMES, levelsFor, type Limb } from "#shared/limbs";
import { CAUSES, FAMILY_RELATIONS, ROLES, type PatientSummary, type Role } from "#shared/model";

// Clinic admin: people who can sign in (add, rename, deactivate with Undo), the patients and their
// care team, and a new patient without a discharge letter. No clinical changes happen here.
const api = useApi("admin");
const T = useT();
const lang = useLang();
const toast = useToast();
const accounts = useAccounts();

type Row = PatientSummary & { careTeam: { physioId: string | null; doctorId: string | null } | null };
const patients = ref<Row[]>([]);
const loading = ref(true);
const loadError = ref("");
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [, p] = await Promise.all([accounts.load(), api<{ patients: Row[] }>("/api/patients")]);
    patients.value = p.patients;
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const tab = ref<"people" | "patients">("people");
const icons: Record<Role, Component> = { patient: UserRound, family: Users, physio: HeartPulse, doctor: Stethoscope, admin: ShieldCheck };
const roleKey: Record<Role, TextKey> = { patient: "rolePatient", family: "roleFamily", physio: "rolePhysio", doctor: "roleDoctor", admin: "roleAdmin" };
const byRole = computed(() => ROLES.map((r) => ({ role: r, list: accounts.list.value.filter((a) => a.role === r) })));
const patientName = (id: string | null) => patients.value.find((p) => p.id === id)?.name ?? "";
const clinicians = (role: "physio" | "doctor") => accounts.list.value.filter((a) => a.role === role && a.active);
const nameOf = (id: string | null) => accounts.list.value.find((a) => a.id === id)?.name ?? T("admAnyone");

// ---- Accounts ----
const editing = ref<Account | null>(null);
const editName = ref("");
function openAccount(a: Account) {
  editing.value = a;
  editName.value = a.name;
}
async function patchAccount(a: Account, body: Partial<Account>) {
  const r = await api<{ accounts: Account[] }>(`/api/accounts/${a.id}`, { method: "PATCH", body });
  accounts.list.value = r.accounts;
}
async function saveName() {
  const a = editing.value;
  if (!a || !editName.value.trim()) return;
  try {
    await patchAccount(a, { name: editName.value.trim() });
    editing.value = null;
    toast.show(T("saved"), { tone: "good", ms: 1800 });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}
async function setActive(a: Account, active: boolean) {
  try {
    await patchAccount(a, { active });
    editing.value = null;
    if (!active) toast.show(T("admDeactivated"), { tone: "good", undo: () => patchAccount(a, { active: true }) });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}
const adding = ref(false);
const draft = reactive({ role: "physio" as Role, name: "", patientId: "" });
const needsPatient = computed(() => draft.role === "patient" || draft.role === "family");
async function addAccount() {
  try {
    const r = await api<{ accounts: Account[]; account: Account }>("/api/accounts", { method: "POST", body: { ...draft, patientId: needsPatient.value ? draft.patientId : null } });
    accounts.list.value = r.accounts;
    adding.value = false;
    toast.show(T("admAdded"), { tone: "good", undo: () => patchAccount(r.account, { active: false }) });
    Object.assign(draft, { name: "", patientId: "" });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}

// ---- Care team ----
const teamFor = ref<Row | null>(null);
const team = reactive({ physioId: "" as string, doctorId: "" as string });
function openTeam(p: Row) {
  teamFor.value = p;
  team.physioId = p.careTeam?.physioId ?? "";
  team.doctorId = p.careTeam?.doctorId ?? "";
}
async function saveTeam() {
  const p = teamFor.value;
  if (!p) return;
  const before = p.careTeam;
  try {
    const r = await api<{ careTeam: Row["careTeam"] }>(`/api/patients/${p.id}/care-team`, { method: "PUT", body: { physioId: team.physioId || null, doctorId: team.doctorId || null } });
    p.careTeam = r.careTeam;
    teamFor.value = null;
    toast.show(T("saved"), {
      tone: "good",
      undo: async () => {
        const back = await api<{ careTeam: Row["careTeam"] }>(`/api/patients/${p.id}/care-team`, { method: "PUT", body: before ?? {} });
        p.careTeam = back.careTeam;
      },
    });
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  }
}

// ---- New patient ----
const newOpen = ref(false);
const blank = () => ({
  name: "",
  age: "" as number | "",
  lang: lang.value,
  limbs: [{ site: "lower", side: "left", level: "below_knee" }] as Limb[],
  cause: "unknown" as (typeof CAUSES)[number],
  surgeryDate: "",
  restrictions: "",
  physioId: "",
  doctorId: "",
  family: [] as { name: string; relation: (typeof FAMILY_RELATIONS)[number]; livesWithPatient: boolean; phone: string }[],
});
const np = reactive(blank());
const creating = ref(false);
const createError = ref("");
function addLimb() {
  if (np.limbs.length >= 4) return;
  np.limbs.push({ site: "upper", side: "right", level: "below_elbow" });
}
function siteChanged(l: Limb) {
  if (!levelsFor(l.site).includes(l.level)) l.level = l.site === "lower" ? "below_knee" : "below_elbow";
}
async function createPatient() {
  creating.value = true;
  createError.value = "";
  try {
    const r = await api<{ patient: { id: string; name: string } }>("/api/patients", {
      method: "POST",
      body: { ...np, surgeryDate: np.surgeryDate || null, physioId: np.physioId || null, doctorId: np.doctorId || null },
    });
    newOpen.value = false;
    Object.assign(np, blank());
    toast.show(T("admPatientAdded", { name: r.patient.name }), { tone: "good" });
    await load();
  } catch (e) {
    createError.value = errorMessage(e);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <section class="app-col admin">
    <header class="adm-head">
      <p class="eyebrow">{{ T("roleAdmin") }}</p>
      <h1>{{ T("admTitle") }}</h1>
      <p class="hint">{{ T("admLede") }}</p>
    </header>

    <div class="seg seg-full" role="tablist">
      <button role="tab" :aria-selected="tab === 'people'" :class="{ on: tab === 'people' }" @click="tab = 'people'">{{ T("admTabPeople") }}</button>
      <button role="tab" :aria-selected="tab === 'patients'" :class="{ on: tab === 'patients' }" @click="tab = 'patients'">{{ T("admTabPatients") }}</button>
    </div>

    <p v-if="loadError" class="error">{{ loadError }} <button class="link" @click="load">{{ T("tryAgain") }}</button></p>
    <div v-else-if="loading && !patients.length" class="card adm-loading" aria-busy="true" />

    <!-- People -->
    <template v-else-if="tab === 'people'">
      <button class="primary big-btn" @click="adding = true"><UserPlus class="ic" aria-hidden="true" /> {{ T("admAddPerson") }}</button>
      <section v-for="g in byRole" :key="g.role" class="adm-group">
        <h2><component :is="icons[g.role]" class="ic" aria-hidden="true" /> {{ T(roleKey[g.role]) }} <span class="hint">· {{ g.list.length }}</span></h2>
        <p v-if="!g.list.length" class="hint">{{ T("admEmpty") }}</p>
        <ul v-else class="adm-list">
          <li v-for="a in g.list" :key="a.id">
            <button class="adm-row" :class="{ off: !a.active }" @click="openAccount(a)">
              <span class="avatar" aria-hidden="true">{{ a.name.replace(/^(Pak|Bu|Ibu|Mas|dr\.)\s+/i, "").slice(0, 1) }}</span>
              <span class="adm-main">
                <b>{{ a.name }}</b>
                <span class="hint"><template v-if="a.patientId">{{ patientName(a.patientId) }}</template><template v-if="!a.active"> · {{ T("admInactive") }}</template></span>
              </span>
              <ChevronRight class="ic" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>
    </template>

    <!-- Patients -->
    <template v-else>
      <button class="primary big-btn" @click="newOpen = true"><Plus class="ic" aria-hidden="true" /> {{ T("admAddPatient") }}</button>
      <ul class="adm-list">
        <li v-for="p in patients" :key="p.id">
          <button class="adm-row" @click="openTeam(p)">
            <span class="avatar" aria-hidden="true">{{ p.name.replace(/^(Pak|Bu|Ibu|Mas)\s+/i, "").slice(0, 1) }}</span>
            <span class="adm-main">
              <b>{{ p.name }}<span class="hint"> · {{ p.age }}</span></b>
              <span class="hint">{{ T("admPhysio") }}: {{ nameOf(p.careTeam?.physioId ?? null) }} · {{ T("admDoctor") }}: {{ nameOf(p.careTeam?.doctorId ?? null) }}</span>
            </span>
            <ChevronRight class="ic" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </template>

    <!-- Account detail -->
    <UiSheet :open="!!editing" :title="editing?.name ?? ''" @close="editing = null">
      <form v-if="editing" class="stack" @submit.prevent="saveName">
        <p class="hint">{{ T(roleKey[editing.role]) }}<template v-if="editing.patientId"> · {{ patientName(editing.patientId) }}</template></p>
        <label class="field"><span>{{ T("admName") }}</span><input v-model="editName" maxlength="60" required /></label>
        <button class="primary big-btn" :disabled="!editName.trim()"><Save class="ic" aria-hidden="true" /> {{ T("save") }}</button>
        <button v-if="editing.active" type="button" class="ghost danger big-btn" @click="setActive(editing, false)">{{ T("admDeactivate") }}</button>
        <button v-else type="button" class="ghost big-btn" @click="setActive(editing, true)">{{ T("admActivate") }}</button>
      </form>
    </UiSheet>

    <!-- New account -->
    <UiSheet :open="adding" :title="T('admAddPerson')" @close="adding = false">
      <form class="stack" @submit.prevent="addAccount">
        <div class="field"><span>{{ T("admRole") }}</span>
          <div class="chip-row">
            <button v-for="r in ROLES" :key="r" type="button" class="choice" :class="{ on: draft.role === r }" :aria-pressed="draft.role === r" @click="draft.role = r">{{ T(roleKey[r]) }}</button>
          </div>
        </div>
        <label class="field"><span>{{ T("admName") }}</span><input v-model="draft.name" maxlength="60" required /></label>
        <label v-if="needsPatient" class="field"><span>{{ T("admPatient") }}</span>
          <select v-model="draft.patientId" required><option value="" disabled /><option v-for="p in patients" :key="p.id" :value="p.id">{{ p.name }}</option></select>
        </label>
        <button class="primary big-btn" :disabled="!draft.name.trim() || (needsPatient && !draft.patientId)"><UserPlus class="ic" aria-hidden="true" /> {{ T("admAddPerson") }}</button>
      </form>
    </UiSheet>

    <!-- Care team -->
    <UiSheet :open="!!teamFor" :title="teamFor ? `${T('admCareTeam')} · ${teamFor.name}` : ''" @close="teamFor = null">
      <form class="stack" @submit.prevent="saveTeam">
        <label class="field"><span>{{ T("admPhysio") }}</span>
          <select v-model="team.physioId"><option value="">{{ T("admAnyone") }}</option><option v-for="a in clinicians('physio')" :key="a.id" :value="a.id">{{ a.name }}</option></select>
        </label>
        <label class="field"><span>{{ T("admDoctor") }}</span>
          <select v-model="team.doctorId"><option value="">{{ T("admAnyone") }}</option><option v-for="a in clinicians('doctor')" :key="a.id" :value="a.id">{{ a.name }}</option></select>
        </label>
        <button class="primary big-btn"><Save class="ic" aria-hidden="true" /> {{ T("admSaveTeam") }}</button>
      </form>
    </UiSheet>

    <!-- New patient -->
    <UiSheet :open="newOpen" :title="T('admAddPatient')" @close="newOpen = false">
      <form class="stack" @submit.prevent="createPatient">
        <label class="field"><span>{{ T("admName") }}</span><input v-model="np.name" maxlength="60" required /></label>
        <div class="two">
          <label class="field"><span>{{ T("admAge") }}</span><input v-model.number="np.age" type="number" min="1" max="120" inputmode="numeric" required /></label>
          <label class="field"><span>{{ T("admLanguage") }}</span><select v-model="np.lang"><option v-for="l in LANGS" :key="l" :value="l">{{ LANG_NAMES[l] }}</option></select></label>
        </div>

        <div class="field"><span>{{ T("admAmputations") }}</span>
          <div v-for="(l, i) in np.limbs" :key="i" class="limb-row">
            <div class="seg">
              <button type="button" :class="{ on: l.site === 'lower' }" @click="l.site = 'lower'; siteChanged(l)">{{ T("limbLeg") }}</button>
              <button type="button" :class="{ on: l.site === 'upper' }" @click="l.site = 'upper'; siteChanged(l)">{{ T("limbArm") }}</button>
            </div>
            <div class="seg">
              <button type="button" :class="{ on: l.side === 'left' }" @click="l.side = 'left'">{{ T("left") }}</button>
              <button type="button" :class="{ on: l.side === 'right' }" @click="l.side = 'right'">{{ T("right") }}</button>
            </div>
            <select v-model="l.level" :aria-label="T('admAmputations')"><option v-for="lv in levelsFor(l.site)" :key="lv" :value="lv">{{ LEVEL_NAMES[lv][lang] }}</option></select>
            <button v-if="np.limbs.length > 1" type="button" class="ghost small-btn" :aria-label="T('admRemove')" @click="np.limbs.splice(i, 1)"><Trash2 class="ic" aria-hidden="true" /></button>
          </div>
          <button v-if="np.limbs.length < 4" type="button" class="link" @click="addLimb">+ {{ T("admAddLimb") }}</button>
        </div>

        <div class="two">
          <label class="field"><span>{{ T("admCause") }}</span><select v-model="np.cause"><option v-for="c in CAUSES" :key="c" :value="c">{{ T(`crCause_${c}` as TextKey) }}</option></select></label>
          <label class="field"><span>{{ T("admSurgery") }}</span><input v-model="np.surgeryDate" type="date" /></label>
        </div>
        <label class="field"><span>{{ T("admRestrictions") }}</span><textarea v-model="np.restrictions" rows="2" maxlength="300" /></label>
        <div class="two">
          <label class="field"><span>{{ T("admPhysio") }}</span><select v-model="np.physioId"><option value="">{{ T("admAnyone") }}</option><option v-for="a in clinicians('physio')" :key="a.id" :value="a.id">{{ a.name }}</option></select></label>
          <label class="field"><span>{{ T("admDoctor") }}</span><select v-model="np.doctorId"><option value="">{{ T("admAnyone") }}</option><option v-for="a in clinicians('doctor')" :key="a.id" :value="a.id">{{ a.name }}</option></select></label>
        </div>

        <div class="field"><span>{{ T("admFamily") }}</span>
          <div v-for="(m, i) in np.family" :key="i" class="fam-row card">
            <input v-model="m.name" maxlength="40" :placeholder="T('admName')" :aria-label="T('admName')" />
            <select v-model="m.relation" :aria-label="T('admRole')"><option v-for="r in FAMILY_RELATIONS" :key="r" :value="r">{{ T(`rel_${r}` as TextKey) }}</option></select>
            <label class="check inline"><input v-model="m.livesWithPatient" type="checkbox" /> {{ T("admLivesWith") }}</label>
            <button type="button" class="link" @click="np.family.splice(i, 1)">{{ T("admRemove") }}</button>
          </div>
          <button v-if="np.family.length < 6" type="button" class="link" @click="np.family.push({ name: '', relation: 'spouse', livesWithPatient: true, phone: '' })">+ {{ T("admAddFamily") }}</button>
        </div>

        <p v-if="createError" class="error">{{ createError }}</p>
        <button class="primary big-btn" :disabled="creating || !np.name.trim() || !np.age"><Plus class="ic" aria-hidden="true" /> {{ T("admAddPatient") }}</button>
      </form>
    </UiSheet>
  </section>
</template>

<style scoped>
.adm-head { display: grid; gap: 4px; }
.adm-head h1 { font-size: clamp(1.5rem, 6vw, 2rem); }
.adm-loading { min-height: 200px; }
.adm-group { display: grid; gap: 8px; }
.adm-group h2 { display: flex; gap: 8px; align-items: center; font-size: 1.0625rem; }
.adm-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.adm-row { width: 100%; display: flex; gap: 12px; align-items: center; min-height: 64px; padding: 10px 14px; border-radius: var(--r-card); border: 1px solid var(--line); background: var(--surface); color: var(--ink); text-align: left; cursor: pointer; transition: transform var(--dur-press) var(--ease-out); }
.adm-row:active { transform: scale(0.98); }
.adm-row.off { opacity: 0.6; }
.adm-main { display: grid; flex: 1; min-width: 0; }
.avatar { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--pine-soft); color: var(--pine); font-weight: 700; flex: none; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.choice { min-height: 44px; padding: 6px 14px; border-radius: var(--r-pill); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer; }
.choice.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.two input, .two select { width: 100%; min-width: 0; }
.limb-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.limb-row select { flex: 1; min-width: 140px; }
.fam-row { display: grid; gap: 8px; padding: 12px; }
</style>
