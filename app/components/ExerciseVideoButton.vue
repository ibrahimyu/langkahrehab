<script setup lang="ts">
import { ExternalLink, Play } from "lucide-vue-next";
import { exerciseById } from "#shared/exercises";
import type { Level } from "#shared/pose";
import type { TextKey } from "#shared/i18n";
import { embedUrl, thumbnailUrl, videoFor, watchUrl } from "#shared/videos";

// Thumbnail that opens the exercise's how-to video (clinical source) in a sheet.
// The player loads only after the tap, so the home screen stays light on data.
const props = defineProps<{ exerciseId: string; level: Level }>();
const lang = useLang();
const T = useT();
const open = ref(false);
const video = computed(() => videoFor(props.exerciseId, props.level));
const name = computed(() => exerciseById(props.exerciseId)?.name[lang.value] ?? "");
</script>

<template>
  <button v-if="video" class="video-thumb" :aria-label="`${T('howToDo')}: ${name}`" @click="open = true">
    <img :src="thumbnailUrl(video)" alt="" loading="lazy" />
    <span class="video-play"><Play class="ic" aria-hidden="true" /></span>
  </button>
  <MediaFrame v-else class="thumb" kind="video" :src="`/media/exercises/${exerciseId}.mp4`" :label="T('video')" />

  <UiSheet v-if="video" :open="open" :title="name" @close="open = false">
    <div class="video-frame">
      <iframe v-if="open" :src="embedUrl(video, lang)" :title="video.title" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" />
    </div>
    <p class="hint">{{ T("videoBy", { source: video.channel }) }} · {{ T(`videoSource_${video.source}` as TextKey) }}</p>
    <p class="note">{{ T("videoSafety") }}</p>
    <a :href="watchUrl(video)" target="_blank" rel="noopener" class="link with-ic">{{ T("openOnYoutube") }} <ExternalLink class="ic" aria-hidden="true" /></a>
  </UiSheet>
</template>

<style scoped>
.video-thumb { position: relative; width: 84px; height: 56px; flex: none; padding: 0; border: 0; border-radius: 12px; overflow: hidden; background: var(--sunken); cursor: pointer; transition: transform var(--dur-press) var(--ease-out); }
.video-thumb:active { transform: scale(0.97); }
.video-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.video-play { position: absolute; inset: 0; display: grid; place-items: center; }
.video-play .ic { width: 32px; height: 32px; padding: 7px; border-radius: 50%; background: color-mix(in srgb, var(--night) 72%, transparent); color: var(--on-night); }
.video-frame { position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: var(--night); }
.video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
</style>
