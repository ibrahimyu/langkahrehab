<script setup lang="ts">
import { locale, type TextKey } from "#shared/i18n";

// Pain before and after each session (oldest first), the doctor's limit as a dashed line, the values
// on the bars, and one sentence on what the trend means. Used by the patient and the family.
export type PainPoint = { id: string; at: string; before: number | null; after: number | null };
const props = defineProps<{ points: PainPoint[]; limit: number; family?: boolean }>();
const T = useT();
const lang = useLang();
const shown = computed(() => props.points.filter((s) => s.after !== null || s.before !== null).slice(-7));
const trend = computed(() => {
  const after = shown.value.map((s) => s.after).filter((v): v is number => v !== null);
  if (after.length < 3) return null;
  const first = Math.round((after[0]! + after[1]!) / 2);
  const last = Math.round((after.at(-1)! + after.at(-2)!) / 2);
  const kind = last >= props.limit ? "over" : last > first ? "up" : last < first ? "down" : "same";
  return { kind, first, last };
});
const weekday = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { weekday: "short" });
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });
</script>

<template>
  <section v-if="shown.length" class="pain-detail">
    <p v-if="trend" class="pain-say" :class="`trend-${trend.kind}`">{{ T(`${family ? "painFam" : "painTrend"}_${trend.kind}` as TextKey, { a: trend.first, b: trend.last, limit }) }}</p>
    <div class="pain-chart" role="img" :aria-label="T('pain')">
      <span class="pain-limit" :style="{ bottom: `${(limit / 10) * 100}%` }"><span>{{ T("painLimitN", { n: limit }) }}</span></span>
      <div v-for="s in shown" :key="s.id" class="pain-col">
        <div class="pain-pair">
          <i class="before" :class="{ low: (s.before ?? 0) < 2 }" :style="{ height: `${((s.before ?? 0) / 10) * 100}%` }"><b>{{ s.before ?? "" }}</b></i>
          <i class="after" :class="{ high: s.after !== null && s.after >= limit, low: (s.after ?? 0) < 2 }" :style="{ height: `${((s.after ?? 0) / 10) * 100}%` }"><b>{{ s.after ?? "" }}</b></i>
        </div>
        <span class="pain-day"><b>{{ weekday(s.at) }}</b>{{ day(s.at) }}</span>
      </div>
    </div>
    <p class="pain-legend hint"><span><i class="before" /> {{ T("painBefore") }}</span><span><i class="after" /> {{ T("painAfterShort") }}</span><small>{{ T("painDates") }}</small></p>
  </section>
</template>

<style scoped>
.pain-detail { display: grid; gap: 10px; margin-bottom: 12px; }
.pain-say { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--sunken); font-weight: 600; }
.pain-say.trend-up, .pain-say.trend-over { background: var(--dawn-soft); }
.pain-say.trend-down { background: var(--pine-soft); }
.pain-chart { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; height: 160px; padding-top: 8px; border-bottom: 1px solid var(--line); }
.pain-limit { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--danger-ink); pointer-events: none; }
.pain-limit span { position: absolute; left: 0; top: -20px; font-size: 0.75rem; font-weight: 700; color: var(--danger-ink); background: var(--surface); padding: 0 4px; }
.pain-col { display: grid; grid-template-rows: 1fr auto; min-width: 0; container-type: inline-size; }
.pain-pair { display: flex; gap: 2px; align-items: flex-end; justify-content: center; height: 100%; }
.pain-pair i, .pain-legend i { display: inline-block; width: 14px; flex: none; border-radius: 3px 3px 0 0; }
.pain-pair i { position: relative; min-height: 2px; }
/* The value sits inside the top of its bar, so it never crosses the limit line. */
.pain-pair i b { position: absolute; left: 50%; top: 1px; transform: translateX(-50%); font-size: 0.6875rem; font-style: normal; line-height: 1.4; color: var(--ink); }
.pain-pair i.low b { top: auto; bottom: 100%; color: var(--ink-2); }
.pain-pair .after:not(.low) b { color: var(--surface); }
.pain-pair .before, .pain-legend .before { background: var(--line-strong); }
.pain-pair .after, .pain-legend .after { background: var(--pine); }
.pain-pair .after.high { background: var(--danger-ink); }
.pain-day { display: grid; font-size: 0.6875rem; line-height: 1.3; color: var(--ink-3); text-align: center; padding-top: 4px; }
.pain-day b { color: var(--ink-2); font-weight: 600; }
/* Too narrow for two labels side by side: keep only the "after" value, the one that matters. */
@container (max-width: 34px) {
  .pain-pair i { width: 40%; }
  .pain-pair .before b { display: none; }
}
.pain-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; margin: 0; }
.pain-legend span { display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
.pain-legend i { height: 10px; }
.pain-legend small { flex-basis: 100%; font-size: 0.75rem; color: var(--ink-3); }
</style>
