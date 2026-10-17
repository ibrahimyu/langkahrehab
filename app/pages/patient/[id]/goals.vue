<script setup lang="ts">
const id = useRoute().params.id as string;
</script>

<template>
  <PatientShell :patient-id="id">
    <PatientGoals :patient-id="id" />
  </PatientShell>
</template>
