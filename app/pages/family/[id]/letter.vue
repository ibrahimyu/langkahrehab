<script setup lang="ts">
const id = useRoute().params.id as string;
const T = useT();
const { view } = useFamily(id);
</script>

<template>
  <FamilyShell :patient-id="id">
    <LetterExplained v-if="view?.letterExplanation" :explanation="view.letterExplanation" family />
    <p v-else class="card">{{ T("letNone") }}</p>
  </FamilyShell>
</template>
