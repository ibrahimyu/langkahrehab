<script setup lang="ts">
import { Copy, Mail, Share2 } from "lucide-vue-next";

// Share (KEL-03, kit CopyButton): the phone's own share menu when there is one, so people pick
// email, SMS or any app themselves. Otherwise two plain choices: Send by email, Copy text. No WhatsApp lock-in.
const props = defineProps<{ text: string; label?: string; small?: boolean }>();
const T = useT();
const toast = useToast();
const fallback = ref(false);

async function share() {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title: T("famShareSubject"), text: props.text });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }
  fallback.value = true;
}
const mailto = computed(() => `mailto:?subject=${encodeURIComponent(T("famShareSubject"))}&body=${encodeURIComponent(props.text)}`);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text);
  } catch {
    // Older browsers: select a hidden textarea and copy.
    const ta = document.createElement("textarea");
    ta.value = props.text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  fallback.value = false;
  toast.show(T("famCopied"), { tone: "good", ms: 1800 });
}
</script>

<template>
  <button type="button" class="ghost" :class="{ 'small-btn': small }" @click="share"><Share2 class="ic" aria-hidden="true" /> {{ label ?? T("famShare") }}</button>
  <UiSheet :open="fallback" :title="label ?? T('famShare')" @close="fallback = false">
    <pre class="share-preview">{{ text }}</pre>
    <div class="stack">
      <a class="primary big-btn" :href="mailto" @click="fallback = false"><Mail class="ic" aria-hidden="true" /> {{ T("famSendEmail") }}</a>
      <button class="ghost big-btn" @click="copy"><Copy class="ic" aria-hidden="true" /> {{ T("famCopyText") }}</button>
    </div>
  </UiSheet>
</template>

<style scoped>
.share-preview { margin: 0; padding: 14px; border-radius: var(--r-input); background: var(--sunken); color: var(--ink-2); font: inherit; font-size: 0.9375rem; white-space: pre-wrap; max-height: 40dvh; overflow: auto; }
</style>
