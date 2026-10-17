<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
const id = useRoute().params.id as string;
const T = useT();
</script>

<template>
  <div class="app-col">
      <NuxtLink :to="`/patient/${id}/exercise`" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("sesToday") }}</NuxtLink>
      <PatientSession :patient-id="id" @saved="(sid) => navigateTo(`/patient/${id}/summary/${sid}`)" />
  </div>
</template>
