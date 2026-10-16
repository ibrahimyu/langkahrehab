<script setup lang="ts">
const id = useRoute().params.id as string;
const T = useT();
</script>

<template>
  <div class="phone-col">
    <div class="phone">
      <NuxtLink :to="`/patient/${id}`" class="link back">← {{ T("home") }}</NuxtLink>
      <PatientSession :patient-id="id" @saved="(sid) => navigateTo(`/patient/${id}/summary/${sid}`)" />
    </div>
  </div>
</template>
