<script setup lang="ts">
// The app's own confirmation, replacing window.confirm (unstyled, untranslated button labels).
// Used only for actions that cannot be undone; everything else gets Undo instead (DESIGN §0, rule 7).
const props = defineProps<{ open: boolean; title: string; body?: string; confirmLabel: string; danger?: boolean }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
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
</script>

<template>
  <dialog ref="el" class="confirm" role="alertdialog" :aria-label="title" @close="emit('cancel')">
    <h2>{{ title }}</h2>
    <p v-if="body" class="confirm-body">{{ body }}</p>
    <div class="confirm-actions">
      <!-- Cancel first and focused: the safe choice is the default (default effect). -->
      <button class="ghost" autofocus @click="emit('cancel')">{{ T("cancel") }}</button>
      <button :class="danger ? 'ghost danger' : 'primary'" @click="emit('confirm')">{{ confirmLabel }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.confirm { border: 0; border-radius: var(--r-sheet); padding: 22px; width: min(440px, calc(100% - 32px)); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-float); display: grid; gap: 12px; }
.confirm:not([open]) { display: none; }
.confirm::backdrop { background: color-mix(in srgb, var(--ink) 45%, transparent); }
.confirm-body { color: var(--ink-2); }
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-top: 6px; }
.confirm-actions button { min-width: 112px; }
.confirm[open] { animation: pop var(--dur) var(--ease-out) both; }
@keyframes pop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: none; } }
</style>
