<script setup lang="ts">
import type { Patient } from "#shared/model";

const id = useRoute().params.id as string;
const api = useApi("patient");
const T = useT();
const patient = ref<Patient | null>(null);
const error = ref("");
onMounted(async () => {
  try {
    patient.value = (await api<{ patient: Patient }>(`/api/patients/${id}`)).patient;
  } catch (e) {
    error.value = errorMessage(e);
  }
});
</script>

<template>
  <PatientShell :patient-id="id">
    <p v-if="error" class="error">{{ error }}</p>
    <LetterExplained v-else-if="patient?.letterExplanation" :explanation="patient.letterExplanation" />
    <p v-else-if="patient" class="card">{{ T("letNone") }}</p>
  </PatientShell>
</template>
