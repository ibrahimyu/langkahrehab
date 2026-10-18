<script setup lang="ts">
import { EyeOff, Play } from "lucide-vue-next";
import type { Level, Side } from "#shared/pose";
import type { Limb } from "#shared/limbs";
import { videoFor } from "#shared/videos";

// The clinician's video playing next to the camera, muted and looping, so the patient can copy the
// movement while the camera checks it. Loads only after the first tap (no autoplay data cost).
const props = defineProps<{ exerciseId: string; level: Level | { level: Level; side: Side; limbs?: Limb[] } }>();
const emit = defineEmits<{ hide: [] }>();
const T = useT();
const video = computed(() => videoFor(props.exerciseId, props.level));
const on = ref(false);
watch(() => props.exerciseId, () => (on.value = false));
const src = computed(() => {
  const v = video.value;
  return v ? `https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${v.youtubeId}&playsinline=1&rel=0&modestbranding=1` : "";
});
</script>

<template>
  <div v-if="video" class="demo">
    <iframe v-if="on" :src="src" :title="video.title" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" />
    <button v-else class="demo-start" @click="on = true">
      <img :src="`https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`" alt="" />
      <span class="demo-play"><Play class="ic" aria-hidden="true" /> {{ T("demoWatch") }}</span>
    </button>
    <button class="demo-hide" :aria-label="T('demoHide')" @click="emit('hide')"><EyeOff class="ic" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.demo { position: relative; width: 100%; height: 100%; min-height: 0; border-radius: var(--r-card); overflow: hidden; background: var(--night); }
.demo iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.demo-start { position: absolute; inset: 0; padding: 0; border: 0; background: none; cursor: pointer; }
.demo-start img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.8; }
.demo-play { position: absolute; inset: 0; display: flex; gap: 8px; align-items: center; justify-content: center; color: var(--on-night); font-weight: 700; }
.demo-play .ic { width: 44px; height: 44px; padding: 12px; border-radius: 50%; background: color-mix(in srgb, var(--night) 72%, transparent); }
.demo-hide { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--night) 72%, transparent); color: var(--on-night); cursor: pointer; }
</style>
