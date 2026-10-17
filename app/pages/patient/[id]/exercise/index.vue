<script setup lang="ts">
const id = useRoute().params.id as string;
</script>

<template>
  <ExerciseList :patient-id="id" />
</template>
