<script setup lang="ts">
const route = useRoute();
const id = route.params.id as string;
const exerciseId = route.params.exerciseId as string;
</script>

<template>
  <ExerciseTutor :patient-id="id" :exercise-id="exerciseId" />
</template>
