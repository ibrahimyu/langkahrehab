<script setup lang="ts">
const id = useRoute().params.id as string;
const role = useRole();
onMounted(() => (role.value = "patient"));
</script>

<template>
  <PatientShell :patient-id="id">
      <PatientHome :patient-id="id" variant="home" @start="navigateTo(`/patient/${id}/exercise`)" @skin="navigateTo(`/patient/${id}/skin`)" />
  </PatientShell>
</template>
