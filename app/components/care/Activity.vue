<script setup lang="ts">
import { ChevronDown, ChevronRight, Scale, Sparkles } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import { feedFor } from "#shared/activity";
import type { ActivityActor, ActivityEvent, Patient } from "#shared/model";

// Agent Activity Feed (FIS-08): who changed what, so the care team can trust the AI. AI items carry
// a violet sparkle, rule items a scale, people their initials. One daily cycle is one item that opens
// into its steps. Every item links to the thing it is about. `compact`: the 5 newest, no filter.
const props = defineProps<{ patient: Patient; compact?: boolean }>();
const T = useT();
const lang = useLang();

type Row = { ev: ActivityEvent; steps: ActivityEvent[] };
const rows = computed<Row[]>(() => {
  const all = feedFor(props.patient);
  const heads = new Map<string, ActivityEvent>();
  for (const e of all) if (e.groupId && e.action === "act_daily") heads.set(e.groupId, e);
  const out: Row[] = [];
  for (const e of all) {
    const head = e.groupId ? heads.get(e.groupId) : undefined;
    if (head && head !== e) continue;
    out.push({ ev: e, steps: head ? all.filter((x) => x.groupId === e.groupId && x !== e) : [] });
  }
  return out;
});

const filter = ref<"all" | ActivityActor>("all");
const shown = computed(() => {
  const list = props.compact || filter.value === "all" ? rows.value : rows.value.filter((r) => r.ev.actor === filter.value || r.steps.some((s) => s.actor === filter.value));
  return props.compact ? list.slice(0, 5) : list;
});
const count = (a: ActivityActor) => rows.value.filter((r) => r.ev.actor === a || r.steps.some((s) => s.actor === a)).length;
const open = ref<Set<string>>(new Set());
const toggle = (id: string) => {
  const next = new Set(open.value);
  if (!next.delete(id)) next.add(id);
  open.value = next;
};

// Params are stored as codes; show them in the reader's language where we know the word.
function param(k: string, v: string | number, action: string): string | number {
  const s = String(v);
  if (k === "kind" && action.startsWith("act_alert")) return T(`kind_${s}` as TextKey);
  if (k === "kind" && action === "act_diary") return s === "phantom_pain" ? T("phantom") : T("mood");
  if (k === "urgency" && ["none", "monitor", "contact_soon", "urgent"].includes(s)) return T(`urgency_${s}` as TextKey);
  if (k === "criterion" && ["wound", "volume", "range", "strength", "skin", "engagement", "falls_home"].includes(s)) return T(`rdCrit_${s}` as TextKey);
  if (k === "status" && ["not_assessed", "not_yet", "progressing", "met"].includes(s)) return T(`rdStatus_${s}` as TextKey);
  if (k === "reason" && ["too_soon", "pain", "technique", "patient_preference", "other"].includes(s)) return T(`reject_${s}` as TextKey);
  return v;
}
function title(e: ActivityEvent) {
  const params = Object.fromEntries(Object.entries(e.params).map(([k, v]) => [k, param(k, v, e.action)]));
  try {
    return T(e.action as TextKey, params);
  } catch {
    return e.action.replace(/^act_/, "").replace(/_/g, " ");
  }
}

const ROLE_WORD: Record<string, TextKey> = { doctor: "roleDoctor", physio: "rolePhysio", patient: "rolePatient", family: "roleFamily" };
function who(e: ActivityEvent) {
  if (e.actor === "ai") return T("actor_ai");
  if (e.actor === "rule") return T("actWhoRules");
  if (e.who === "patient") return props.patient.name;
  return ROLE_WORD[e.who] ? T(ROLE_WORD[e.who]!) : e.who;
}
const initials = (e: ActivityEvent) => who(e).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const roleClass = (e: ActivityEvent) => (ROLE_WORD[e.who] ? `who-${e.who}` : "who-other");

const ACTION_TAB: Record<string, string> = {
  act_readiness: "readiness", act_cleared: "readiness", act_cleared_undone: "readiness", act_goal_reached: "readiness", act_goal_undone: "readiness",
  act_plan: "plan", act_at_max: "plan", act_intake_confirmed: "profile", act_brief: "overview",
};
function link(e: ActivityEvent): string | null {
  if (e.refs[0]?.id) return evidenceLink(props.patient.id, e.refs[0]);
  if (e.action.startsWith("act_proposal")) return recordLink(props.patient.id, "plan");
  const tab = ACTION_TAB[e.action];
  return tab ? recordLink(props.patient.id, tab) : null;
}
const when = (iso: string) => new Date(iso).toLocaleString(locale(lang.value), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const FILTERS = ["all", "ai", "rule", "human"] as const;
</script>

<template>
  <section class="ac">
    <nav v-if="!compact && rows.length" class="cr-tabs ac-filter" role="tablist" :aria-label="T('crTab_activity')">
      <button v-for="f in FILTERS" :key="f" role="tab" :aria-selected="filter === f" :class="{ on: filter === f }" @click="filter = f">
        {{ f === "all" ? T("actAll") : T(`actor_${f}` as TextKey) }} · {{ f === "all" ? rows.length : count(f) }}
      </button>
    </nav>

    <div v-if="!rows.length" class="cr-empty">
      <Sparkles class="ic" aria-hidden="true" />
      <p>{{ T("actEmpty") }}</p>
    </div>
    <p v-else-if="!shown.length" class="cr-meta ac-none">{{ T("actNoneFor", { who: T(`actor_${filter}` as TextKey) }) }}</p>

    <ol v-else class="ac-list">
      <li v-for="row in shown" :key="row.ev.id" class="ac-item">
        <span class="ac-av" :class="[`ac-${row.ev.actor}`, row.ev.actor === 'human' && roleClass(row.ev)]" aria-hidden="true">
          <Sparkles v-if="row.ev.actor === 'ai'" class="ic" />
          <Scale v-else-if="row.ev.actor === 'rule'" class="ic" />
          <template v-else>{{ initials(row.ev) }}</template>
        </span>
        <div class="ac-body">
          <p class="ac-title">
            <NuxtLink v-if="link(row.ev)" :to="link(row.ev)!" class="ac-link">{{ title(row.ev) }}</NuxtLink>
            <template v-else>{{ title(row.ev) }}</template>
          </p>
          <p v-if="row.ev.quote" class="ac-quote">“{{ row.ev.quote }}”</p>
          <p class="cr-meta">{{ who(row.ev) }} · {{ when(row.ev.at) }}</p>
          <template v-if="row.steps.length">
            <button class="link ac-toggle" :aria-expanded="open.has(row.ev.id)" @click="toggle(row.ev.id)">
              <ChevronDown v-if="open.has(row.ev.id)" class="ic" aria-hidden="true" /><ChevronRight v-else class="ic" aria-hidden="true" />
              {{ open.has(row.ev.id) ? T("actHideSteps") : T("actDailySteps", { n: row.steps.length }) }}
            </button>
            <ol v-if="open.has(row.ev.id)" class="ac-steps">
              <li v-for="s in row.steps" :key="s.id">
                <span class="ac-av sm" :class="`ac-${s.actor}`" aria-hidden="true"><Sparkles v-if="s.actor === 'ai'" class="ic" /><Scale v-else class="ic" /></span>
                <span>
                  <NuxtLink v-if="link(s)" :to="link(s)!" class="ac-link">{{ title(s) }}</NuxtLink>
                  <template v-else>{{ title(s) }}</template>
                  <span v-if="s.quote" class="ac-quote"> · “{{ s.quote }}”</span>
                </span>
              </li>
            </ol>
          </template>
        </div>
      </li>
    </ol>
    <NuxtLink v-if="compact && rows.length > 5" :to="recordLink(patient.id, 'activity')" class="link ac-all">{{ T("actSeeAll") }} · {{ rows.length }}</NuxtLink>
  </section>
</template>

<style scoped>
.ac { display: grid; gap: 12px; min-width: 0; }
.ac-filter { position: static; }
.ac-none { margin: 0; padding: 8px 2px; }
.ac-list { list-style: none; margin: 0; padding: 0; display: grid; }
.ac-item { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); animation: pop-in var(--dur) var(--ease-out) both; }
.ac-item:last-child { border-bottom: 0; }
.ac-av { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font: 700 0.8125rem/1 var(--font); background: var(--sunken); color: var(--ink); }
.ac-av .ic { width: 18px; height: 18px; }
.ac-av.sm { width: 26px; height: 26px; flex: none; }
.ac-av.sm .ic { width: 14px; height: 14px; }
.ac-ai { background: var(--ai-soft); color: var(--ai-ink); }
.ac-rule { background: var(--sunken); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line-strong); }
.ac-human { background: var(--surface); box-shadow: inset 0 0 0 2px currentColor; }
.who-doctor { color: var(--role-doctor); }
.who-physio { color: var(--role-physio); }
.who-patient { color: var(--role-patient); }
.who-family { color: var(--role-family); }
.ac-body { display: grid; gap: 4px; min-width: 0; }
.ac-title { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.ac-link { color: var(--ink); text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 3px; }
.ac-link:hover { text-decoration-color: var(--pine); color: var(--pine); }
.ac-quote { margin: 0; color: var(--ink-2); overflow-wrap: anywhere; }
.ac-toggle { justify-self: start; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; }
.ac-steps { list-style: none; margin: 0; padding: 4px 0 0; display: grid; gap: 8px; }
.ac-steps li { display: flex; gap: 10px; align-items: flex-start; font-size: 0.9375rem; }
.ac-all { justify-self: start; }
</style>
