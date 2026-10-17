<script setup lang="ts">
const id = useRoute().params.id as string;
</script>

<template>
  <PatientShell :patient-id="id">
    <PatientMe :patient-id="id" />
  </PatientShell>
</template>
