<script setup lang="ts">
import { ArrowLeft, Camera, FileText, Lock } from "lucide-vue-next";
import type { Intake } from "#shared/intake";
import { SAMPLE_LETTERS, type SampleLetter } from "#shared/sampleLetters";

// DOK-01 step 1–3: choose a photo (or a sample letter), shrink it in the browser, read it once.
// A letter the family sent (DOK-07) arrives with ?patient=&letter= and is read straight away.
const route = useRoute();
const router = useRouter();
const T = useT();
const lang = useLang();
const { account } = useSession();
const isDoctor = computed(() => account.value?.role === "doctor");
const api = useApi("doctor");
const images = useLetterImages();

const stage = ref<"pick" | "reading" | "checking">("pick");
const error = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

async function read(body: Record<string, unknown>, image: string | null) {
  error.value = "";
  stage.value = "reading";
  try {
    const res = await api<{ intake: Intake; fallback: boolean }>("/api/intake", { method: "POST", body });
    stage.value = "checking";
    if (image) images.value = { ...images.value, [res.intake.id]: image };
    await new Promise((r) => setTimeout(r, 450));
    await router.replace(`/care/intake/${res.intake.id}`);
  } catch (e) {
    error.value = errorMessage(e);
    stage.value = "pick";
  }
}

async function onFile(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files?.length) return;
  try {
    const pages = await readLetterFiles(files);
    (e.target as HTMLInputElement).value = "";
    await read({ pages, lang: lang.value }, pages.find((x) => x.startsWith("data:image")) ?? null);
  } catch (err) {
    error.value = errorMessage(err);
  }
}
function useSample(s: SampleLetter) {
  const image = drawSampleLetter(s.lines);
  void read({ image, sample: s.id, lang: s.lang }, image);
}

let started = false;
onMounted(() =>
  watch(isDoctor, (doctor) => {
    const { patient, letter } = route.query;
    if (started || !doctor || typeof patient !== "string" || typeof letter !== "string") return;
    started = true;
    void read({ patientId: patient, letterId: letter }, null);
  }, { immediate: true }),
);
</script>

<template>
  <div class="care-page ik-page">
    <NuxtLink to="/care" class="link back"><ArrowLeft class="ic" aria-hidden="true" /> {{ T("patients") }}</NuxtLink>
    <header class="care-head">
      <p class="eyebrow">{{ T("careTeam") }} · {{ T("roleDoctor") }}</p>
      <h1>{{ T("ikNewFromLetter") }}</h1>
    </header>

    <div v-if="!isDoctor" class="card cr-empty">
      <Lock class="ic" aria-hidden="true" />
      <p>{{ T("ikDoctorOnly") }}</p>
    </div>

    <div v-else-if="stage !== 'pick'" class="card ik-reading" role="status" aria-live="polite">
      <ol class="ik-stages">
        <li :class="{ on: stage === 'reading', done: stage === 'checking' }"><span class="ik-dot" />{{ T("ikReading") }}</li>
        <li :class="{ on: stage === 'checking' }"><span class="ik-dot" />{{ T("ikChecking") }}</li>
      </ol>
    </div>

    <template v-else>
      <p v-if="error" class="error">{{ error }}</p>
      <section class="card ik-pick">
        <button class="ik-drop" type="button" @click="fileInput?.click()">
          <Camera class="ic" aria-hidden="true" />
          <b>{{ T("ikTakePhoto") }}</b>
          <span class="cr-meta">{{ T("ikFileTypes") }}</span>
        </button>
        <input ref="fileInput" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple @change="onFile" />
        <p class="cr-meta">{{ T("ikPhotoPrivacy") }}</p>
      </section>
      <section class="ik-samples" :aria-label="T('ikUseSample')">
        <h2 class="cr-h">{{ T("ikUseSample") }}</h2>
        <button v-for="s in SAMPLE_LETTERS" :key="s.id" type="button" class="card ik-sample" @click="useSample(s)">
          <FileText class="ic" aria-hidden="true" />
          <span><b>{{ s.title }}</b><br /><span class="cr-meta">{{ T("ikSampleLabel") }} · {{ s.lang.toUpperCase() }} · {{ T("ikLines", { n: s.lines.length }) }}</span></span>
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ik-page { max-width: 760px; margin: 0 auto; }
.ik-pick { display: grid; gap: 10px; }
.ik-drop { display: grid; justify-items: center; gap: 6px; padding: 32px 16px; border: 2px dashed var(--line-strong); border-radius: var(--r-card); background: var(--sunken); color: var(--ink); font: inherit; cursor: pointer; transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.ik-drop:active { transform: scale(0.99); }
@media (hover: hover) and (pointer: fine) { .ik-drop:hover { border-color: var(--pine); } }
.ik-drop .ic { width: 32px; height: 32px; color: var(--pine); }
.ik-samples { display: grid; gap: 10px; }
.ik-sample { display: flex; align-items: center; gap: 12px; text-align: left; border: 0; font: inherit; color: var(--ink); cursor: pointer; transition: transform var(--dur-press) var(--ease-out); }
.ik-sample:active { transform: scale(0.99); }
.ik-sample .ic { color: var(--pine); flex: none; }
.ik-reading { padding: 28px 20px; }
.ik-stages { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.ik-stages li { display: flex; align-items: center; gap: 12px; color: var(--ink-3); font-weight: 700; }
.ik-stages li.on, .ik-stages li.done { color: var(--ink); }
.ik-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--sunken); flex: none; }
.ik-stages li.done .ik-dot { background: var(--pine); }
.ik-stages li.on .ik-dot { background: var(--pine); animation: ik-pulse 1.1s var(--ease-move) infinite alternate; }
@keyframes ik-pulse { from { opacity: 0.35; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .ik-stages li.on .ik-dot { animation: none; } }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
