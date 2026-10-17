<script setup lang="ts">
import { ChevronRight, FileScan, Plus } from "lucide-vue-next";
import type { Intake } from "#shared/intake";
import { locale } from "#shared/i18n";

// Doctor's home (DOK-01): start a new patient from a discharge letter, and pick up drafts not yet confirmed.
const api = useApi("doctor");
const T = useT();
const lang = useLang();
const { data, error, status, refresh } = useAsyncData("care-intakes", () => api<{ intakes: Intake[] }>("/api/intake"), { server: false });
const drafts = computed(() => data.value?.intakes ?? []);
const when = (iso: string) => new Date(iso).toLocaleString(locale(lang.value), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
</script>

<template>
  <section class="card ik-home" :aria-label="T('ikLetters')">
    <div class="ik-home-top">
      <span class="ik-home-ic"><FileScan class="ic" aria-hidden="true" /></span>
      <h2 class="ik-home-title">{{ T("ikLetters") }}</h2>
      <NuxtLink to="/care/intake/new" class="primary ik-new"><Plus class="ic" aria-hidden="true" /> {{ T("ikNewFromLetter") }}</NuxtLink>
    </div>
    <p v-if="error" class="error">{{ errorMessage(error) }} <button class="link" @click="refresh()">{{ T("tryAgain") }}</button></p>
    <div v-else-if="status === 'pending' && !data" class="ik-skel" aria-hidden="true" />
    <ul v-else-if="drafts.length" class="ik-drafts">
      <li v-for="d in drafts" :key="d.id">
        <NuxtLink :to="`/care/intake/${d.id}`" class="ik-draft">
          <span class="ik-draft-main">
            <b>{{ d.fields.patientName.value || T("ikUnnamed") }}</b>
            <span class="cr-meta">{{ d.letterId ? T("ikFromFamily") : T("ikDraft") }} · {{ when(d.updatedAt) }}</span>
          </span>
          <span class="pill">{{ T("ikReview") }}</span>
          <ChevronRight class="ic" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.ik-home { display: grid; gap: 12px; }
.ik-home-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ik-home-ic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--pine-soft); color: var(--pine); flex: none; }
.ik-home-title { font-size: 1.0625rem; flex: 1 1 140px; }
.ik-new { flex: 1 1 100%; }
@media (min-width: 560px) { .ik-new { flex: none; } }
.ik-skel { height: 56px; border-radius: 14px; background: var(--sunken); }
.ik-drafts { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ik-draft { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 14px; background: var(--sunken); color: var(--ink); text-decoration: none; transition: transform var(--dur-press) var(--ease-out); }
.ik-draft:active { transform: scale(0.99); }
.ik-draft-main { display: grid; gap: 2px; flex: 1; min-width: 0; }
.ik-draft .ic { color: var(--ink-3); flex: none; }
</style>
