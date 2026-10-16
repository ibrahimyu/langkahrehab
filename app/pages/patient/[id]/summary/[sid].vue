<script setup lang="ts">
const route = useRoute();
const id = route.params.id as string;
const sid = route.params.sid as string;
const T = useT();
</script>

<template>
  <div class="phone-col">
    <div class="phone">
      <PatientSummary :patient-id="id" :session-id="sid">
        <NuxtLink :to="`/patient/${id}`" class="primary big-btn">{{ T("home") }}</NuxtLink>
      </PatientSummary>
    </div>
  </div>
</template>
