<script setup lang="ts">
const id = useRoute().params.id as string;
const T = useT();
</script>

<template>
  <div class="phone-col">
    <div class="phone">
      <NuxtLink :to="`/patient/${id}`" class="link back">← {{ T("home") }}</NuxtLink>
      <PatientSkin :patient-id="id" />
    </div>
  </div>
</template>
