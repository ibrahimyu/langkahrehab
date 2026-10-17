<script setup lang="ts">
import { Bell, MapPin, Undo2 } from "lucide-vue-next";
import { needsItem, returnSoon } from "#shared/family";
import type { TextKey } from "#shared/i18n";
import type { FamilyTask } from "#shared/model";

// Small facts under a family task: a reminder is on, where the item stands, a return date coming up.
const props = defineProps<{ task: FamilyTask }>();
const T = useT();
const dayText = useDayText();
const today = new Date().toISOString().slice(0, 10);
const s = computed(() => props.task.sourcing);
</script>

<template>
  <span v-if="task.reminder && task.status === 'open'" class="pill"><Bell class="ic" aria-hidden="true" /> {{ T(`remEvery_${task.reminder.every}` as TextKey) }}</span>
  <span v-if="needsItem(task) && s && s.status !== 'looking'" class="pill kind-borrow"><MapPin class="ic" aria-hidden="true" /> {{ s.status === "borrowed" && s.from ? T("navBorrowedFrom", { from: s.from }) : T(`navStatus_${s.status}` as TextKey) }}</span>
  <span v-if="returnSoon(task, today)" class="pill warn"><Undo2 class="ic" aria-hidden="true" /> {{ T("navReturnBy") }} {{ dayText(s!.returnBy!) }}</span>
</template>

<style scoped>
.kind-borrow { background: var(--info-soft); color: var(--info-ink); }
.warn { background: var(--dawn-soft); color: var(--ink); }
</style>
