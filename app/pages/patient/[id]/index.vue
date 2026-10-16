<script setup lang="ts">
const id = useRoute().params.id as string;
const role = useRole();
onMounted(() => (role.value = "patient"));
</script>

<template>
  <div class="phone-col">
    <div class="phone">
      <PatientHome :patient-id="id" variant="home" @start="navigateTo(`/patient/${id}/session`)" @skin="navigateTo(`/patient/${id}/skin`)" />
    </div>
  </div>
</template>
