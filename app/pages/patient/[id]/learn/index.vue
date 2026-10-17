<script setup lang="ts">
const id = useRoute().params.id as string;
</script>

<template>
  <PatientShell :patient-id="id">
    <PatientLearn :patient-id="id" />
  </PatientShell>
</template>
