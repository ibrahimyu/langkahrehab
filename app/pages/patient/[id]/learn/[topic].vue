<script setup lang="ts">
const route = useRoute();
const id = route.params.id as string;
const topic = computed(() => route.params.topic as string);
</script>

<template>
  <PatientShell :patient-id="id">
    <PatientLearn :key="topic" :patient-id="id" :topic="topic" />
  </PatientShell>
</template>
