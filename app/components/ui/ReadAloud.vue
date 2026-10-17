<script setup lang="ts">
import { Square, Volume2 } from "lucide-vue-next";

// Read aloud button (PAS-12): the browser's own voice in the app language, hidden where there is none.
const props = defineProps<{ text: string }>();
const T = useT();
const reader = useReadAloud();
</script>

<template>
  <button v-if="reader.supported.value" type="button" class="ghost small-btn" :aria-pressed="reader.speaking.value" @click="reader.toggle(props.text)">
    <component :is="reader.speaking.value ? Square : Volume2" class="ic" aria-hidden="true" /> {{ reader.speaking.value ? T("stopReading") : T("readAloud") }}
  </button>
</template>
