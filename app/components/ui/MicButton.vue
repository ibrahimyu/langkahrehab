<script setup lang="ts">
import { Mic, MicOff } from "lucide-vue-next";

// Speak instead of typing (DESIGN §0, rule 5). Uses the browser's own speech recognition, in the app
// language; hidden where the browser has none. Final text is emitted for the field to append.
const emit = defineEmits<{ text: [value: string] }>();
const lang = useLang();
const T = useT();
const listening = ref(false);
const supported = ref(false);
let rec: any = null;
const tags = { en: "en-US", id: "id-ID", zh: "zh-CN" } as const;

onMounted(() => {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  supported.value = !!SR;
  if (!SR) return;
  rec = new SR();
  rec.interimResults = false;
  rec.continuous = false;
  rec.onresult = (e: any) => {
    const text = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(" ").trim();
    if (text) emit("text", text);
  };
  rec.onend = () => (listening.value = false);
  rec.onerror = () => (listening.value = false);
});
onBeforeUnmount(() => rec?.abort?.());

function toggle() {
  if (!rec) return;
  if (listening.value) return rec.stop();
  rec.lang = tags[lang.value];
  listening.value = true;
  rec.start();
}
</script>

<template>
  <button v-if="supported" type="button" class="ghost mic" :class="{ on: listening }" :aria-pressed="listening" @click="toggle">
    <MicOff v-if="listening" class="ic" aria-hidden="true" /><Mic v-else class="ic" aria-hidden="true" />
    <span>{{ listening ? T("listening") : T("speak") }}</span>
  </button>
</template>

<style scoped>
.mic { flex: none; }
.mic.on { background: var(--danger-soft); color: var(--danger-ink); border-color: transparent; }
</style>
