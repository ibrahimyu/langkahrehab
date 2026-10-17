<script setup lang="ts">
import type { Profile } from "#shared/model";
import { limbsOf, type LimbLevel, type LimbSite } from "#shared/limbs";

// X-ray-style diagram of arms and legs with every amputation level marked (DAT-14). Viewed like an
// X-ray: the patient's right side is on the viewer's left. Used until a real image is added.
const props = defineProps<{ profile: Profile; label: string }>();

type Seg = { y1: number; y2: number; w: number };
const SHAPE: Record<LimbSite, { x: { right: number; left: number }; segs: Seg[]; joint: { cy: number; r: number } }> = {
  lower: { x: { right: 82, left: 118 }, segs: [{ y1: 148, y2: 188, w: 10 }, { y1: 200, y2: 238, w: 9 }, { y1: 244, y2: 256, w: 8 }], joint: { cy: 194, r: 6 } },
  upper: { x: { right: 50, left: 150 }, segs: [{ y1: 64, y2: 98, w: 8 }, { y1: 110, y2: 144, w: 7 }, { y1: 150, y2: 162, w: 7 }], joint: { cy: 104, r: 5 } },
};
/** Where the line is drawn for each level, in diagram units. */
const CUT: Record<LimbLevel, number> = {
  hip: 144, above_knee: 170, knee: 194, below_knee: 216, ankle: 241, partial_foot: 249, toe: 254,
  shoulder: 60, above_elbow: 84, elbow: 104, below_elbow: 126, wrist: 147, partial_hand: 155, finger: 160,
};

const limbs = computed(() => limbsOf(props.profile));
const parts = computed(() =>
  (["lower", "upper"] as const).flatMap((site) =>
    (["right", "left"] as const).map((side) => {
      const s = SHAPE[site];
      const x = s.x[side];
      const lost = limbs.value.find((l) => l.site === site && l.side === side);
      const cut = lost ? CUT[lost.level] : null;
      const pieces = s.segs.flatMap((g) => {
        if (cut === null || cut >= g.y2) return [{ ...g, solid: true }];
        if (cut <= g.y1) return [{ ...g, solid: false }];
        return [{ ...g, y2: cut, solid: true }, { ...g, y1: cut, solid: false }];
      });
      const exercising = !limbs.value.length && site === "lower" && props.profile.side === side;
      return { key: `${site}-${side}`, x, cut, pieces, joint: { ...s.joint, solid: cut === null || cut > s.joint.cy + s.joint.r }, exercising };
    }),
  ),
);
// Colours come from tokens (see <style>); only the solid/ghost state is set here.
const bone = (solid: boolean) => ({ opacity: solid ? 1 : 0.22, "stroke-dasharray": solid ? undefined : "5 5" });
</script>

<template>
  <svg viewBox="0 0 200 270" role="img" :aria-label="label" class="limb">
    <rect class="bg" width="200" height="270" rx="14" />
    <text class="lbl" x="14" y="22" font-size="13" font-weight="700">R</text>
    <text class="lbl" x="178" y="22" font-size="13" font-weight="700">L</text>
    <circle class="body" cx="100" cy="28" r="13" />
    <path class="body" d="M54 54 Q100 44 146 54 L142 62 Q100 54 58 62 Z" />
    <line class="spine" x1="100" y1="44" x2="100" y2="128" stroke-width="6" stroke-linecap="round" />
    <path class="body" d="M66 128 Q100 114 134 128 L128 148 Q100 140 72 148 Z" opacity="0.9" />
    <g v-for="l in parts" :key="l.key" class="bones" stroke-linecap="round" fill="none">
      <line v-for="(g, i) in l.pieces" :key="i" :x1="l.x" :y1="g.y1" :x2="l.x" :y2="g.y2" :stroke-width="g.w" v-bind="bone(g.solid)" :class="{ hl: l.exercising }" />
      <circle :cx="l.x" :cy="l.joint.cy" :r="l.joint.r" stroke-width="3" v-bind="bone(l.joint.solid)" />
      <template v-if="l.cut !== null">
        <line :x1="l.x - 18" :y1="l.cut" :x2="l.x + 18" :y2="l.cut" class="cut" stroke-width="3" stroke-dasharray="6 4" />
        <circle class="cut-dot" :cx="l.x" :cy="l.cut" r="4" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.limb { display: block; width: 100%; height: 100%; }
.bg { fill: var(--night); }
.lbl { fill: var(--on-night-2); }
.body { fill: var(--on-night-2); opacity: 0.6; }
.spine { stroke: var(--on-night-2); opacity: 0.5; }
.bones { stroke: var(--on-night-2); }
.bones .hl { stroke: var(--dawn); }
.cut { stroke: var(--dawn); }
.cut-dot { fill: var(--dawn); }
</style>
