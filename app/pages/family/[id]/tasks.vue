<script setup lang="ts">
const id = useRoute().params.id as string;
</script>

<template>
  <FamilyShell :patient-id="id">
    <FamilyTasks :patient-id="id" />
  </FamilyShell>
</template>
