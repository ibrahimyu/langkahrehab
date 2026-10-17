<script setup lang="ts">
const id = useRoute().params.id as string;
</script>

<template>
  <PatientShell :patient-id="id">
    <PatientCalendar :patient-id="id" />
  </PatientShell>
</template>
