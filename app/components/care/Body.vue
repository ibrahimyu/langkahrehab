<script setup lang="ts">
import { Footprints, ScanSearch } from "lucide-vue-next";
import { locale, type TextKey } from "#shared/i18n";
import type { Patient, SkinArea } from "#shared/model";

// Body (FIS-05): pain after sessions against the doctor's limit, phantom pain over time, and skin
// checks per place. Read-only: numbers come from sessions, the diary and photos.
const props = defineProps<{ patient: Patient }>();
const T = useT();
const lang = useLang();
const day = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short" });

const limit = computed(() => props.patient.plan.painThreshold);
const pain = computed(() => props.patient.sessions.filter((s) => s.painAfter !== null).slice(-14));

// Phantom pain: a line of the last 30 scores (0–10).
const phantom = computed(() => props.patient.diary.filter((d) => d.kind === "phantom_pain" && d.score !== null).slice(-30));
const W = 320;
const H = 120;
const points = computed(() => {
  const list = phantom.value;
  const n = list.length;
  return list.map((d, i) => ({ x: n === 1 ? W / 2 : 8 + (i * (W - 16)) / (n - 1), y: 8 + ((10 - d.score!) / 10) * (H - 16), d }));
});
const line = computed(() => points.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
const lastPhantom = computed(() => phantom.value.at(-1));

const areas: SkinArea[] = ["residual_limb", "other_foot"];
const checksIn = (a: SkinArea) => [...props.patient.skinChecks].filter((c) => c.area === a).reverse().slice(0, 6);
</script>

<template>
  <section class="cr-section">
    <!-- Pain after sessions, against the limit -->
    <article class="card cr-item">
      <div class="cr-top">
        <h2 class="cr-h">{{ T("crPainAfter") }}</h2>
        <span class="pill">{{ T("crLimitN", { n: limit }) }}</span>
      </div>
      <div v-if="pain.length" class="cr-bars" role="img" :aria-label="pain.map((s) => `${day(s.at)}: ${s.painAfter}`).join(', ')">
        <div class="cr-limit" :style="{ bottom: `${(limit / 10) * 100}%` }"><span>{{ limit }}</span></div>
        <div v-for="s in pain" :key="s.id" class="cr-bar" :title="`${day(s.at)}: ${s.painBefore ?? '–'} → ${s.painAfter}`">
          <span class="cr-bar-n" :class="{ over: s.painAfter! >= limit }">{{ s.painAfter }}</span>
          <div class="cr-bar-fill" :class="{ over: s.painAfter! >= limit }" :style="{ height: `${Math.max(4, (s.painAfter! / 10) * 100)}%` }" />
        </div>
      </div>
      <p v-else class="hint">{{ T("noSessions") }}</p>
    </article>

    <!-- Phantom pain -->
    <article class="card cr-item">
      <div class="cr-top">
        <h2 class="cr-h">{{ T("crPhantomPain") }}</h2>
        <span v-if="lastPhantom" class="cr-big">{{ lastPhantom.score }}<small>/10 · {{ day(lastPhantom.at) }}</small></span>
      </div>
      <svg v-if="phantom.length" class="cr-line" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="phantom.map((d) => `${day(d.at)}: ${d.score}`).join(', ')">
        <line v-for="g in [0, 5, 10]" :key="g" x1="0" :x2="W" :y1="8 + ((10 - g) / 10) * (H - 16)" :y2="8 + ((10 - g) / 10) * (H - 16)" class="grid" />
        <polyline :points="line" class="stroke" />
        <circle v-for="(p, i) in points" :key="i" :cx="p.x" :cy="p.y" :r="i === points.length - 1 ? 5 : 3" class="dot" :class="{ last: i === points.length - 1 }" />
      </svg>
      <p v-else class="hint">{{ T("noneYet") }}</p>
    </article>

    <!-- Skin checks per place -->
    <div class="cr-grid two">
      <article v-for="a in areas" :key="a" class="card cr-item">
        <h2 class="cr-h"><component :is="a === 'residual_limb' ? ScanSearch : Footprints" class="ic" aria-hidden="true" /> {{ T(`crArea_${a}` as TextKey) }}</h2>
        <ul v-if="checksIn(a).length" class="cr-list">
          <li v-for="c in checksIn(a)" :key="c.id" class="cr-skin">
            <div class="cr-top">
              <span class="pill urgency" :class="c.result.urgency">{{ T(`urgency_${c.result.urgency}` as TextKey) }}</span>
              <span class="cr-meta">{{ day(c.at) }}</span>
            </div>
            <p>{{ c.result.careTeamNote }}</p>
            <span v-if="c.result.findings.length" class="cr-actions">
              <span v-for="(f, k) in c.result.findings" :key="k" class="pill">{{ T(`crSign_${f.sign}` as TextKey) }} · {{ Math.round(f.confidence * 100) }}%</span>
            </span>
          </li>
        </ul>
        <p v-else class="hint">{{ T("noneYet") }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.cr-bars { position: relative; display: flex; align-items: flex-end; gap: 4px; height: 160px; padding-top: 22px; }
.cr-bar { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; }
.cr-bar-fill { width: 100%; max-width: 28px; border-radius: 6px 6px 2px 2px; background: var(--pine-light); transition: height var(--dur-slow) var(--ease-out); }
.cr-bar-fill.over { background: var(--danger); }
.cr-bar-n { font-size: 0.75rem; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.cr-bar-n.over { color: var(--danger-ink); }
.cr-limit { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--danger); pointer-events: none; }
.cr-limit span { position: absolute; right: 0; top: -22px; font-size: 0.75rem; font-weight: 700; color: var(--danger-ink); background: var(--surface); padding: 0 4px; }
.cr-big { font: 700 1.75rem/1 var(--display); color: var(--dawn-ink); font-variant-numeric: tabular-nums; }
.cr-big small { font-size: 0.8125rem; font-weight: 600; font-family: var(--font); color: var(--ink-3); }
.cr-line { width: 100%; height: 140px; display: block; }
.cr-line .grid { stroke: var(--line); stroke-width: 1; vector-effect: non-scaling-stroke; }
.cr-line .stroke { fill: none; stroke: var(--dawn-ink); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.cr-line .dot { fill: var(--surface); stroke: var(--dawn-ink); stroke-width: 2; vector-effect: non-scaling-stroke; }
.cr-line .dot.last { fill: var(--dawn-ink); }
.cr-skin { display: grid; gap: 6px; padding: 10px 12px; border-radius: 12px; background: var(--canvas); }
</style>
