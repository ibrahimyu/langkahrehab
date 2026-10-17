<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
const id = useRoute().params.id as string;
const T = useT();
</script>

<template>
  <div class="app-col">
      <NuxtLink :to="`/patient/${id}`" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("home") }}</NuxtLink>
      <PatientSkin :patient-id="id" />
  </div>
</template>
