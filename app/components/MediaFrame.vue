<script setup lang="ts">
// An image or video from public/media, with a labelled placeholder (or the fallback slot)
// until the real file exists.
const props = defineProps<{ src: string; kind?: "image" | "video"; label: string; icon?: string; poster?: string }>();
const failed = ref(false);
watch(() => props.src, () => (failed.value = false));
</script>

<template>
  <div class="media">
    <template v-if="!failed">
      <video v-if="kind === 'video'" :src="src" :poster="poster" muted loop playsinline autoplay preload="metadata" @error="failed = true" />
      <img v-else :src="src" :alt="label" @error="failed = true" />
    </template>
    <slot v-if="failed" name="fallback">
      <div class="media-ph"><span class="icon" aria-hidden="true">{{ icon ?? (kind === "video" ? "▶" : "▢") }}</span><span>{{ label }}</span></div>
    </slot>
  </div>
</template>
