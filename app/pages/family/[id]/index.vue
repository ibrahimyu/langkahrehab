<script setup lang="ts">
const id = useRoute().params.id as string;
</script>

<template>
  <FamilyShell :patient-id="id">
    <FamilyToday :patient-id="id" />
  </FamilyShell>
</template>
