<script setup lang="ts">
const id = useRoute().params.id as string;
const role = useRole();
const T = useT();
onMounted(() => {
  if (role.value === "patient") role.value = "physio";
});
</script>

<template>
  <div class="care-page" style="max-width: 900px; margin: 0 auto">
    <NuxtLink to="/care" class="link back">← {{ T("patients") }}</NuxtLink>
    <CarePanel :patient-id="id" :role="role === 'doctor' ? 'doctor' : 'physio'" />
  </div>
</template>
