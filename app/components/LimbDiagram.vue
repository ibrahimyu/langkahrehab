<script setup lang="ts">
import type { Profile } from "#shared/model";

// X-ray-style diagram of both legs with the amputation level marked. Viewed like an X-ray:
// the patient's right leg is on the viewer's left. Used until a real image is added.
const props = defineProps<{ profile: Profile; label: string }>();

const legs = computed(() =>
  (["right", "left"] as const).map((side) => {
    const x = side === "right" ? 70 : 130;
    const amputated = props.profile.level !== "none" && props.profile.side === side;
    const cut = !amputated ? null : props.profile.level === "below_knee" ? 175 : 105;
    return { side, x, cut, exercising: props.profile.level === "none" && props.profile.side === side };
  }),
);
const bone = (solid: boolean) => ({ stroke: solid ? "#d5e4f0" : "#d5e4f0", opacity: solid ? 1 : 0.22, "stroke-dasharray": solid ? undefined : "5 5" });
</script>

<template>
  <svg viewBox="0 0 200 260" role="img" :aria-label="label" class="limb">
    <rect width="200" height="260" rx="14" fill="#0f2238" />
    <text x="14" y="22" fill="#7fa7c9" font-size="13" font-weight="700">R</text>
    <text x="178" y="22" fill="#7fa7c9" font-size="13" font-weight="700">L</text>
    <path d="M52 38 Q100 18 148 38 L140 64 Q100 52 60 64 Z" fill="#d5e4f0" opacity="0.9" />
    <g v-for="l in legs" :key="l.side" stroke-linecap="round" fill="none">
      <!-- femur -->
      <line :x1="l.x" y1="66" :x2="l.x" :y2="l.cut && l.cut < 135 ? l.cut : 133" stroke-width="10" v-bind="bone(true)" :stroke="l.exercising ? '#ffc845' : '#d5e4f0'" />
      <line v-if="l.cut && l.cut < 135" :x1="l.x" :y1="l.cut" :x2="l.x" y2="133" stroke-width="10" v-bind="bone(false)" />
      <!-- knee -->
      <circle :cx="l.x" cy="140" r="8" stroke-width="3" v-bind="bone(!l.cut || l.cut > 140)" />
      <!-- tibia -->
      <line :x1="l.x" y1="148" :x2="l.x" :y2="l.cut && l.cut > 140 ? l.cut : 226" stroke-width="9" v-bind="bone(!l.cut || l.cut > 140)" :stroke="l.exercising ? '#ffc845' : '#d5e4f0'" />
      <line v-if="l.cut && l.cut > 140" :x1="l.x" :y1="l.cut" :x2="l.x" y2="226" stroke-width="9" v-bind="bone(false)" />
      <!-- foot -->
      <path :d="`M${l.x - 6} 232 L${l.x + 16} 240`" stroke-width="8" v-bind="bone(!l.cut)" />
      <!-- amputation level -->
      <template v-if="l.cut">
        <line :x1="l.x - 22" :y1="l.cut" :x2="l.x + 22" :y2="l.cut" stroke="#ffc845" stroke-width="3" stroke-dasharray="6 4" />
        <circle :cx="l.x" :cy="l.cut" r="4" fill="#ffc845" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.limb { display: block; width: 100%; height: 100%; }
</style>
