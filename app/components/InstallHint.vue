<script setup lang="ts">
import { Share, Smartphone, X } from "lucide-vue-next";
import { installPrompt } from "~/plugins/pwa.client";

// UXA-08: "Add Langkah to your home screen", shown once after the first session, never inside the installed app.
const props = defineProps<{ sessions: number }>();
const T = useT();
const KEY = "langkah-install-hint";
const dismissed = ref(true);
const ios = ref(false);
onMounted(() => {
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  ios.value = /iphone|ipad|ipod/i.test(navigator.userAgent);
  try {
    dismissed.value = standalone || localStorage.getItem(KEY) === "1";
  } catch {
    dismissed.value = standalone;
  }
});
const show = computed(() => !dismissed.value && props.sessions >= 1 && (ios.value || !!installPrompt.value));
function close() {
  dismissed.value = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
}
async function install() {
  await installPrompt.value?.prompt();
  installPrompt.value = null;
  close();
}
</script>

<template>
  <div v-if="show" class="tile wide install" role="status">
    <span class="install-ic"><Smartphone class="ic" aria-hidden="true" /></span>
    <div class="install-main">
      <b>{{ T("installTitle") }}</b>
      <p v-if="ios" class="hint with-ic">{{ T("installIos") }} <Share class="ic" aria-hidden="true" /></p>
      <button v-else class="primary small-btn" @click="install">{{ T("installAction") }}</button>
    </div>
    <button class="ghost icon-close" :aria-label="T('close')" @click="close"><X class="ic" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.install { display: flex; align-items: flex-start; gap: 12px; }
.install-ic { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 12px; background: var(--pine-soft); color: var(--pine); }
.install-main { display: grid; gap: 6px; flex: 1; min-width: 0; justify-items: start; }
.icon-close { flex: none; min-width: 44px; min-height: 44px; padding: 0; display: grid; place-items: center; }
</style>
