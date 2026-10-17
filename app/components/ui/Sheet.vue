<script setup lang="ts">
import { X } from "lucide-vue-next";

// Bottom sheet for small, dismissable tasks (menus, filters, the care team view on a phone).
// Native <dialog>: focus is trapped and Escape closes it for free. Always a visible Close button,
// because a swipe-to-close gesture is hidden from people who rarely use apps (DESIGN §0).
const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ close: [] }>();
const T = useT();
const el = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (open) => {
    const d = el.value;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  },
  { flush: "post" },
);
onMounted(() => props.open && el.value?.showModal());

// A tap on the scrim (the dialog box itself, outside the panel) closes the sheet.
const onClick = (e: MouseEvent) => e.target === el.value && emit("close");
</script>

<template>
  <dialog ref="el" class="sheet" :aria-label="title" @close="emit('close')" @click="onClick">
    <div class="sheet-panel">
      <header class="sheet-head">
        <h2>{{ title }}</h2>
        <button class="ghost sheet-close" @click="emit('close')"><X class="ic" aria-hidden="true" /> {{ T("close") }}</button>
      </header>
      <div class="sheet-body"><slot /></div>
    </div>
  </dialog>
</template>

<style scoped>
.sheet { padding: 0; border: 0; margin: auto 0 0; width: 100%; max-width: 100%; max-height: 92dvh; background: transparent; color: var(--ink); }
.sheet::backdrop { background: color-mix(in srgb, var(--ink) 45%, transparent); }
.sheet-panel { background: var(--surface); border-radius: var(--r-sheet) var(--r-sheet) 0 0; padding: 8px 20px calc(20px + env(safe-area-inset-bottom)); max-height: 92dvh; overflow: auto; box-shadow: var(--shadow-float); }
.sheet-panel::before { content: ""; display: block; width: 40px; height: 4px; border-radius: var(--r-pill); background: var(--line); margin: 4px auto 8px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; }
.sheet-close { min-height: 44px; }
.sheet-body { display: grid; gap: 20px; }
/* On wide screens the sheet becomes a centred panel instead of a full-width drawer. */
@media (min-width: 768px) {
  .sheet { margin: auto; max-width: 520px; }
  .sheet-panel { border-radius: var(--r-sheet); padding-bottom: 20px; }
  .sheet-panel::before { display: none; }
}
.sheet[open] .sheet-panel { animation: sheet-in var(--dur-slow) var(--ease-sheet) both; }
.sheet[open]::backdrop { animation: fade-in var(--dur-slow) var(--ease-out) both; }
@keyframes sheet-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
</style>
