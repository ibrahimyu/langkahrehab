<script setup lang="ts">
// Circular progress (0–100) used on the home tile and the rest countdown.
const props = defineProps<{ value: number }>();
const R = 40;
const C = 2 * Math.PI * R;
const offset = computed(() => C * (1 - Math.min(100, Math.max(0, props.value)) / 100));
</script>

<template>
  <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="track" cx="50" cy="50" :r="R" />
    <circle class="val" cx="50" cy="50" :r="R" :stroke-dasharray="C" :stroke-dashoffset="offset" />
  </svg>
</template>
