<script setup lang="ts">
import { Image, Play, UserRound } from "lucide-vue-next";
// An image or video from public/media, with a labelled placeholder (or the fallback slot)
// until the real file exists.
const props = defineProps<{ src: string; kind?: "image" | "video"; label: string; icon?: "person" | "play" | "image"; poster?: string }>();
const failed = ref(false);
const iconFor = computed(() => (props.icon === "person" ? UserRound : props.icon === "play" || (!props.icon && props.kind === "video") ? Play : Image));
watch(() => props.src, () => (failed.value = false));
</script>

<template>
  <div class="media">
    <template v-if="!failed">
      <video v-if="kind === 'video'" :src="src" :poster="poster" muted loop playsinline autoplay preload="metadata" @error="failed = true" />
      <img v-else :src="src" :alt="label" loading="lazy" decoding="async" @error="failed = true" />
    </template>
    <slot v-if="failed" name="fallback">
      <div class="media-ph"><component :is="iconFor" class="icon" aria-hidden="true" /><span>{{ label }}</span></div>
    </slot>
  </div>
</template>
