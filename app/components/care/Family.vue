<script setup lang="ts">
import { CircleCheck, Circle, Home, Users } from "lucide-vue-next";
import type { TextKey } from "#shared/i18n";
import type { Patient, Text3 } from "#shared/model";

// The family as the care team sees it (DOK-01 link target): who is there and which tasks are done.
// The family manages its own tasks in the family app; the care team reads them here.
const props = defineProps<{ patient: Patient }>();
const T = useT();
const lang = useLang();

const text = (x: Text3 | string) => (typeof x === "string" ? x : x[lang.value] || x.en);
const memberName = (id: string | null) => props.patient.family.find((m) => m.id === id)?.name ?? T("fmAnyone");
const tasks = computed(() => [...props.patient.familyTasks].sort((a, b) => Number(a.status === "done") - Number(b.status === "done")));
const done = computed(() => props.patient.familyTasks.filter((t) => t.status === "done").length);
</script>

<template>
  <section class="card cr-section">
    <h2><Users class="ic" aria-hidden="true" /> {{ T("fmMembers") }}</h2>
    <p v-if="!patient.family.length" class="cr-meta">{{ T("fmNoMembers") }}</p>
    <ul v-else class="cr-list">
      <li v-for="m in patient.family" :key="m.id" class="fm-member">
        <span class="fm-av" aria-hidden="true">{{ m.name.slice(0, 1).toUpperCase() }}</span>
        <span><b>{{ m.name }}</b><br /><span class="cr-meta">{{ T(`rel_${m.relation}` as TextKey) }}<template v-if="m.livesWithPatient"> · <Home class="ic fm-ic" aria-hidden="true" /> {{ T("fmLives") }}</template></span></span>
      </li>
    </ul>
  </section>

  <section id="family-tasks" class="card cr-section">
    <h2>{{ T("fmTasks", { done, n: patient.familyTasks.length }) }}</h2>
    <p v-if="!tasks.length" class="cr-meta">{{ T("fmNoTasks") }}</p>
    <ul v-else class="cr-list">
      <li v-for="t in tasks" :key="t.id" class="fm-task" :class="{ done: t.status === 'done' }">
        <CircleCheck v-if="t.status === 'done'" class="ic fm-state" aria-hidden="true" />
        <Circle v-else class="ic fm-state" aria-hidden="true" />
        <span>
          <b>{{ text(t.title) }}</b><br />
          <span class="cr-meta">{{ t.status === "done" ? T("fmDone") : T("fmOpen") }} · {{ memberName(t.assigneeId) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.fm-member, .fm-task { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: var(--canvas); overflow-wrap: anywhere; }
.fm-av { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; color: var(--role-family); box-shadow: inset 0 0 0 2px currentColor; }
.fm-ic { width: 14px; height: 14px; vertical-align: -2px; }
.fm-state { flex: none; margin-top: 2px; color: var(--ink-3); }
.fm-task.done .fm-state { color: var(--pine); }
.fm-task.done b { color: var(--ink-2); }
</style>
