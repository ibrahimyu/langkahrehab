<script setup lang="ts">
import type { TextKey } from "#shared/i18n";

// UXA-03: pain 0–10 as eleven big buttons in two rows (0–5, 6–10), with the plain word for each band
// under the numbers. Neutral colours; only numbers at or above the doctor's alert line get a thin
// danger outline. The faces are drawn here (not the copyrighted Wong-Baker FACES).
const props = withDefaults(defineProps<{ threshold?: number | null; tone?: "day" | "night"; label?: string }>(), { threshold: null, tone: "day", label: "" });
const emit = defineEmits<{ pick: [n: number] }>();
const T = useT();

type Band = { key: TextKey; from: number; to: number; mouth: string };
const BANDS: Band[] = [
  { key: "painWordNone", from: 0, to: 0, mouth: "M8 14.5c1.2 1.4 2.5 2 4 2s2.8-.6 4-2" },
  { key: "painWordMild", from: 1, to: 3, mouth: "M8.5 15h7" },
  { key: "painWordModerate", from: 4, to: 6, mouth: "M8.5 16c1-.8 2.2-1.2 3.5-1.2s2.5.4 3.5 1.2" },
  { key: "painWordStrong", from: 7, to: 10, mouth: "M8 17c1.2-1.5 2.5-2.2 4-2.2s2.8.7 4 2.2" },
];
const bandOf = (n: number) => BANDS.find((b) => n >= b.from && n <= b.to)!;
const rows = [
  { nums: [0, 1, 2, 3, 4, 5], bands: [{ b: BANDS[0]!, span: 1 }, { b: BANDS[1]!, span: 3 }, { b: BANDS[2]!, span: 2 }] },
  { nums: [6, 7, 8, 9, 10], bands: [{ b: BANDS[2]!, span: 1 }, { b: BANDS[3]!, span: 4 }] },
];
const over = (n: number) => props.threshold !== null && n >= props.threshold;
</script>

<template>
  <div class="pain-picker" :class="tone" role="group" :aria-label="label || T('painPickerLabel')">
    <div v-for="(row, r) in rows" :key="r" class="pp-row">
      <button
        v-for="n in row.nums"
        :key="n"
        type="button"
        class="pp-btn"
        :class="{ over: over(n) }"
        :aria-label="`${n}, ${T(bandOf(n).key)}`"
        @click="emit('pick', n)"
      >
        {{ n }}
      </button>
      <span v-for="(x, i) in row.bands" :key="i" class="pp-word" :style="{ gridColumn: i === 0 ? `1 / span ${x.span}` : `span ${x.span}` }" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" /><circle cx="9" cy="10" r=".6" fill="currentColor" /><circle cx="15" cy="10" r=".6" fill="currentColor" /><path :d="x.b.mouth" />
        </svg>
        {{ T(x.b.key) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.pain-picker { display: grid; gap: 10px; width: min(100%, 380px); }
.pp-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; row-gap: 4px; }
.pp-btn {
  min-height: 52px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink);
  font: 700 1.25rem/1 var(--display); cursor: pointer; transition: transform var(--dur-press) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.pp-btn:active { transform: scale(0.94); }
.pp-btn.over { border-color: color-mix(in srgb, var(--danger) 70%, transparent); }
.pp-word { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 0; padding-top: 2px; border-top: 2px solid var(--line); font-size: 0.8125rem; color: var(--ink-3); white-space: nowrap; overflow: hidden; }
.pp-word svg { width: 16px; height: 16px; flex: none; }
.night .pp-btn { border-color: var(--night-line); background: var(--night-raised); color: var(--on-night); }
.night .pp-btn.over { border-color: color-mix(in srgb, var(--danger) 70%, transparent); }
.night .pp-word { color: var(--on-night-2, var(--on-night)); border-top-color: var(--night-line); }
@media (prefers-reduced-motion: reduce) { .pp-btn:active { transform: none; } }
</style>
