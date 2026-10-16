<script setup lang="ts">
import { locale, type TextKey } from "#shared/i18n";
import type { Patient, SkinArea, SkinCheck } from "#shared/model";

// Skin photo check: the patient photographs the amputated leg or the other foot; Gemini lists
// visible signs and how soon to contact the clinic. Without a photo, an example result can be shown.
const props = defineProps<{ patientId: string }>();
const api = useApi();
const lang = useLang();
const T = useT();
const version = useDataVersion();
const p = ref<Patient | null>(null);
async function load() {
  p.value = (await api<{ patient: Patient }>(`/api/patients/${props.patientId}`)).patient;
}
onMounted(load);
watch(version, load);

const area = ref<SkinArea>("residual_limb");
const otherSide = computed(() => T(p.value?.profile.side === "left" ? "right" : "left"));
const areaLabel = (a: SkinArea) => (a === "other_foot" ? T("otherFoot", { side: otherSide.value }) : T("amputatedLeg", { side: T(p.value?.profile.side ?? "left") }));
const preview = ref("");
const image = ref("");
const busy = ref(false);
const error = ref("");
const latest = ref<SkinCheck | null>(null);
const urgency = (u: string) => T(`urgency_${u}` as TextKey);

/** Scales the photo down to at most 1280 px and re-encodes it as JPEG. */
async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  error.value = "";
  latest.value = null;
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    preview.value = canvas.toDataURL("image/jpeg", 0.85);
    image.value = preview.value.split(",")[1]!;
  } catch {
    error.value = "Could not read that image.";
  }
}

async function analyse() {
  busy.value = true;
  error.value = "";
  try {
    const res = await api<{ check: SkinCheck }>(`/api/patients/${props.patientId}/skin-check`, {
      method: "POST",
      body: { image: image.value, area: area.value, lang: lang.value },
    });
    latest.value = res.check;
    version.value++;
  } catch (e) {
    error.value = errorMessage(e, "Analysis failed.");
  } finally {
    busy.value = false;
  }
}

const showExample = () => (latest.value = p.value?.skinChecks.at(-1) ?? null);
</script>

<template>
  <div v-if="p" class="patient-view">
    <h1>{{ T("skin") }}</h1>
    <p class="hint">{{ T("skinHint") }}</p>
    <p v-if="p.profile.cause === 'diabetes'" class="note">{{ T("diabetesFoot", { side: otherSide }) }}</p>
    <label class="field">
      <span>{{ T("photoOf") }}</span>
      <select v-model="area">
        <option value="residual_limb">{{ areaLabel("residual_limb") }}</option>
        <option value="other_foot">{{ areaLabel("other_foot") }}</option>
      </select>
    </label>
    <label class="field">
      <span>{{ T("photo") }}</span>
      <input type="file" accept="image/*" capture="environment" @change="onFile" />
    </label>
    <img v-if="preview" :src="preview" alt="" style="width: 100%; border-radius: 12px" />
    <button v-if="preview" class="primary big-btn" :disabled="busy" @click="analyse">{{ busy ? T("checking") : T("checkPhoto") }}</button>
    <button v-else-if="p.skinChecks.length" class="ghost" @click="showExample">{{ T("exampleResult") }}</button>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="latest" class="card skin-result">
      <p v-if="!latest.result.usable" class="alert"><b>{{ T("notClear") }}</b><span>{{ latest.result.retakeTip }}</span></p>
      <template v-else>
        <p><span class="pill urgency" :class="latest.result.urgency">{{ urgency(latest.result.urgency) }}</span></p>
        <p class="lead-text">{{ latest.result.patientMessage }}</p>
        <p v-if="latest.result.urgency === 'contact_soon' || latest.result.urgency === 'urgent'" class="good-text">🔔 {{ T("careTold") }}</p>
      </template>
    </div>
    <p class="hint">{{ T("photoPrivacy") }}</p>

    <h3>{{ T("earlierChecks") }}</h3>
    <ul class="exercise-list">
      <li v-for="c in [...p.skinChecks].reverse()" :key="c.id">
        <span>{{ new Date(c.at).toLocaleDateString(locale(lang), { day: "numeric", month: "short" }) }}</span>
        <span class="hint">{{ areaLabel(c.area) }}</span>
        <span class="dose"><span class="pill urgency" :class="c.result.urgency">{{ c.result.usable ? urgency(c.result.urgency) : T("notClear") }}</span></span>
      </li>
      <li v-if="!p.skinChecks.length" class="hint">{{ T("noneYet") }}</li>
    </ul>
  </div>
</template>
