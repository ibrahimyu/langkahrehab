<script setup lang="ts">
import { ArrowRight, Check, CircleCheck, Pencil, Scale, Sparkles, X } from "lucide-vue-next";
import { exerciseById } from "#shared/exercises";
import { locale, type TextKey } from "#shared/i18n";
import { REJECT_REASONS, type CareRole, type Patient, type Proposal, type RejectReason } from "#shared/model";
import { evaluateProgression, PROG } from "#shared/progression";
import { can } from "#shared/permissions";

// Progression proposal (FIS-06): the rules check readiness and size the step, the AI explains it, and
// the physio decides. Approve saves a new plan version; reject needs a reason (Undo reopens it).
// The doctor sees the same card without the buttons.
const props = defineProps<{ patient: Patient; role: CareRole }>();
const emit = defineEmits<{ patch: [Partial<Patient>] }>();
const api = useApi(() => props.role);
const T = useT();
const lang = useLang();
const toast = useToast();
const canDecide = computed(() => can(props.role, "proposal.decide"));

const pending = computed(() => props.patient.proposals.find((x) => x.status === "pending") ?? null);
const earlier = computed(() => props.patient.proposals.filter((x) => x.status !== "pending").slice(-4).reverse());
// Live check from the same rules the server runs, so the physio sees why there is no proposal yet.
const check = computed(() => evaluateProgression(props.patient, Date.now()));
const passed = computed(() => check.value.eligibility.filter((e) => e.passed).length);

const name = (id: string) => exerciseById(id)?.name[lang.value] ?? id;
const unit = (f: "sets" | "reps") => T(f === "reps" ? "progReps" : "progSets");
const when = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });

const busy = ref(false);
async function decide(x: Proposal, body: Record<string, unknown>) {
  busy.value = true;
  try {
    const r = await api<Partial<Patient>>(`/api/patients/${props.patient.id}/proposals/${x.id}`, { method: "PATCH", body });
    emit("patch", r);
    return r;
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
    return null;
  } finally {
    busy.value = false;
  }
}

// Approve as proposed (confirm first: it changes the patient's plan).
const confirming = ref(false);
async function approve(changes?: { exerciseId: string; field: string; to: number }[]) {
  const x = pending.value;
  if (!x) return;
  confirming.value = false;
  const r = await decide(x, { decision: "approve", changes });
  if (r?.plan) {
    editing.value = false;
    toast.show(T("propApproved", { v: r.plan.version }), { tone: "good" });
  }
}

// Edit then approve: the numbers from the rules, changeable within the doctor's limits.
const editing = ref(false);
const edits = ref<Record<string, number>>({});
const key = (c: { exerciseId: string; field: string }) => `${c.exerciseId}:${c.field}`;
function startEdit() {
  edits.value = Object.fromEntries((pending.value?.changes ?? []).map((c) => [key(c), c.to]));
  editing.value = true;
}
const maxOf = (f: "sets" | "reps") => (f === "reps" ? props.patient.plan.maxReps ?? PROG.defaultMaxReps : props.patient.plan.maxSets ?? PROG.defaultMaxSets);
const saveEdit = () => approve((pending.value?.changes ?? []).map((c) => ({ exerciseId: c.exerciseId, field: c.field, to: Number(edits.value[key(c)]) })));

// Reject: a reason is required.
const rejecting = ref(false);
const reason = ref<RejectReason | null>(null);
const note = ref("");
async function reject() {
  const x = pending.value;
  if (!x || !reason.value) return;
  if (await decide(x, { decision: "reject", rejectReason: reason.value, note: note.value })) {
    rejecting.value = false;
    toast.show(T("propRejectedToast"), { tone: "good", undo: () => void decide(x, { decision: "reopen" }) });
    reason.value = null;
    note.value = "";
  }
}

// Check readiness now (outside the daily cycle): makes a proposal when every rule passes.
const checking = ref(false);
async function runCheck() {
  checking.value = true;
  try {
    const r = await api<{ proposal: Proposal | null; proposals: Proposal[]; activity: Patient["activity"]; alerts: Patient["alerts"] }>(`/api/patients/${props.patient.id}/proposals`, { method: "POST" });
    emit("patch", { proposals: r.proposals, activity: r.activity, alerts: r.alerts });
    if (!r.proposal) toast.show(check.value.atMax ? T("propAtMax") : T("propNotYet", { n: passed.value, total: check.value.eligibility.length }));
  } catch (e) {
    toast.show(errorMessage(e), { tone: "bad" });
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <section class="cr-section">
    <!-- Pending proposal -->
    <article v-if="pending" class="card pr-card">
      <p class="pr-ribbon"><Scale class="ic" aria-hidden="true" /> {{ T("propRibbon") }}</p>
      <h2 class="cr-h">{{ T(canDecide ? "propTitle" : "propTitleDoctor") }}</h2>

      <ul class="pr-diff">
        <li v-for="c in pending.changes" :key="key(c)">
          <span class="pr-ex">{{ name(c.exerciseId) }}</span>
          <span class="pr-num"><s>{{ c.from }}</s> <ArrowRight class="ic" aria-hidden="true" /> <b>{{ c.to }}</b> {{ unit(c.field) }}</span>
        </li>
      </ul>

      <div v-if="pending.rationale" class="pr-why">
        <span class="pill" :class="{ ai: pending.rationaleBy === 'ai' }">
          <Sparkles v-if="pending.rationaleBy === 'ai'" class="ic" aria-hidden="true" /><Scale v-else class="ic" aria-hidden="true" />
          {{ T(pending.rationaleBy === "ai" ? "propAiDraft" : "propTemplateDraft") }}
        </span>
        <p>{{ pending.rationale[lang] }}</p>
        <p v-if="pending.evidence.length" class="pr-chips">
          <span class="cr-meta">{{ T("propEvidence") }}</span>
          <NuxtLink v-for="e in pending.evidence" :key="e.id" class="chip" :to="`/care/${patient.id}?tab=sessions`">{{ e.label }}</NuxtLink>
        </p>
      </div>

      <details class="pr-rules">
        <summary>{{ T("propRulesPassed") }} · {{ pending.eligibility.filter((e) => e.passed).length }}/{{ pending.eligibility.length }}</summary>
        <ul>
          <li v-for="e in pending.eligibility" :key="e.rule" :class="{ no: !e.passed }">
            <component :is="e.passed ? Check : X" class="ic" aria-hidden="true" />
            <span>{{ T(`prog_rule_${e.rule}` as TextKey) }}</span><b>{{ e.value }}</b>
          </li>
        </ul>
      </details>

      <div v-if="canDecide" class="cr-actions">
        <button class="primary" :disabled="busy" @click="confirming = true"><Check class="ic" aria-hidden="true" /> {{ T("propApprove") }}</button>
        <button class="ghost" :disabled="busy" @click="startEdit"><Pencil class="ic" aria-hidden="true" /> {{ T("propEdit") }}</button>
        <button class="ghost" :disabled="busy" @click="rejecting = true"><X class="ic" aria-hidden="true" /> {{ T("propReject") }}</button>
      </div>
      <p class="cr-meta">{{ when(pending.createdAt) }} · plan v{{ pending.basedOnPlanVersion }}</p>
    </article>

    <!-- No proposal: the live rule check -->
    <article v-else class="card pr-card pr-quiet">
      <div class="cr-top">
        <h2 class="cr-h"><Scale class="ic" aria-hidden="true" /> {{ T("propReadyTitle") }}</h2>
        <span class="pill" :class="{ ai: check.eligible }">{{ check.atMax ? T("propAtMax") : check.eligible ? T("propAllPass") : T("propNotYet", { n: passed, total: check.eligibility.length }) }}</span>
      </div>
      <ul class="pr-rules-list">
        <li v-for="e in check.eligibility" :key="e.rule" :class="{ no: !e.passed }">
          <component :is="e.passed ? Check : X" class="ic" aria-hidden="true" />
          <span>{{ T(`prog_rule_${e.rule}` as TextKey) }}</span><b>{{ e.value }}</b>
        </li>
      </ul>
      <div v-if="canDecide" class="cr-actions">
        <button class="ghost" :disabled="checking" @click="runCheck"><CircleCheck class="ic" aria-hidden="true" /> {{ checking ? T("propChecking") : T("propCheck") }}</button>
      </div>
    </article>

    <!-- Earlier decisions -->
    <details v-if="earlier.length" class="card pr-history">
      <summary>{{ T("propHistory") }} · {{ earlier.length }}</summary>
      <ul class="cr-list">
        <li v-for="x in earlier" :key="x.id" class="pr-past">
          <span class="cr-top">
            <span class="pill" :class="{ ai: x.status === 'approved' }">{{ T(`propStatus_${x.status}` as TextKey) }}</span>
            <span class="cr-meta">{{ when(x.decidedAt ?? x.createdAt) }}<template v-if="x.resultPlanVersion"> · plan v{{ x.resultPlanVersion }}</template></span>
          </span>
          <span>{{ x.changes.map((c) => `${name(c.exerciseId)} ${c.from}→${c.to} ${unit(c.field)}`).join(" · ") }}</span>
          <span v-if="x.rejectReason" class="hint">{{ T(`reject_${x.rejectReason}` as TextKey) }}<template v-if="x.rejectNote"> · “{{ x.rejectNote }}”</template></span>
          <button v-if="x.status === 'rejected' && canDecide && !pending && x.basedOnPlanVersion === patient.plan.version" class="link" :disabled="busy" @click="decide(x, { decision: 'reopen' })">{{ T("propReopen") }}</button>
        </li>
      </ul>
    </details>

    <UiConfirmDialog
      :open="confirming"
      :title="T('propApprove')"
      :body="T('propApproveAsk', { v: patient.plan.version + 1 })"
      :confirm-label="T('propApprove')"
      @confirm="approve()"
      @cancel="confirming = false"
    />

    <UiSheet :open="editing" :title="T('propEdit')" @close="editing = false">
      <form v-if="pending" class="stack" @submit.prevent="saveEdit">
        <label v-for="c in pending.changes" :key="key(c)" class="pr-field">
          <span>{{ name(c.exerciseId) }} · {{ unit(c.field) }} <span class="cr-meta">({{ c.from }} → max {{ maxOf(c.field) }})</span></span>
          <input v-model.number="edits[key(c)]" type="number" inputmode="numeric" min="1" :max="maxOf(c.field)" required />
        </label>
        <button class="primary" :disabled="busy">{{ T("propSave") }}</button>
      </form>
    </UiSheet>

    <UiSheet :open="rejecting" :title="T('propRejectWhy')" @close="rejecting = false">
      <form class="stack" @submit.prevent="reject">
        <div class="pr-reasons" role="radiogroup" :aria-label="T('propRejectWhy')">
          <label v-for="r in REJECT_REASONS" :key="r" class="pr-reason" :class="{ on: reason === r }">
            <input v-model="reason" type="radio" name="reject" :value="r" /> {{ T(`reject_${r}` as TextKey) }}
          </label>
        </div>
        <label class="pr-field"><span>{{ T("propNote") }}</span><textarea v-model="note" rows="2" maxlength="200" /></label>
        <button class="primary" :disabled="!reason || busy">{{ T("propReject") }}</button>
      </form>
    </UiSheet>
  </section>
</template>

<style scoped>
.pr-card { display: grid; gap: 12px; min-width: 0; border-left: 4px solid var(--ai-ink); }
.pr-quiet { border-left-color: var(--line-strong); }
.pr-ribbon { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; font-weight: 700; color: var(--ai-ink); }
.pr-ribbon .ic, .cr-h .ic { width: 16px; height: 16px; }
.pr-diff { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.pr-diff li { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--sunken); }
.pr-ex { font-weight: 700; min-width: 0; overflow-wrap: anywhere; }
.pr-num { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.pr-num s { color: var(--ink-3); }
.pr-num b { color: var(--pine); font-size: 1.125rem; }
.pr-num .ic { width: 14px; height: 14px; color: var(--ink-3); }
.pr-why { display: grid; gap: 8px; justify-items: start; padding: 12px; border-radius: 12px; background: var(--ai-soft); }
.pr-why p { overflow-wrap: anywhere; }
.pr-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.pr-chips .chip { text-decoration: none; }
.pr-rules summary, .pr-history summary { cursor: pointer; font-weight: 700; min-height: 44px; display: flex; align-items: center; }
.pr-rules ul, .pr-rules-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.pr-rules li, .pr-rules-list li { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; align-items: center; font-size: 0.9375rem; }
.pr-rules li .ic, .pr-rules-list li .ic { width: 16px; height: 16px; color: var(--pine); }
.pr-rules li.no .ic, .pr-rules-list li.no .ic { color: var(--dawn-ink); }
.pr-rules li b, .pr-rules-list li b { font-variant-numeric: tabular-nums; }
.pr-history { display: grid; gap: 8px; }
.pr-past { display: grid; gap: 4px; padding-top: 8px; border-top: 1px solid var(--line); }
.pr-field { display: grid; gap: 6px; font-weight: 700; }
.pr-reasons { display: grid; gap: 8px; }
.pr-reason { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 10px 14px; border: 1px solid var(--line-strong); border-radius: var(--r-input); cursor: pointer; font-weight: 600; }
.pr-reason.on { border-color: var(--pine); background: var(--pine-soft); }
</style>
