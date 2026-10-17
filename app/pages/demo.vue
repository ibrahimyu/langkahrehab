<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { scenarioById, scenarios } from "#shared/scenarios";

const T = useT();
const { start, busy } = useScenarioStart();
const main = scenarioById("pain-rising")!;
const tryIt = scenarioById("try-yourself")!;
</script>

<template>
  <section class="hero2">
    <div>
      <p class="eyebrow">AI Builders Cup · Team LifeStrong</p>
      <h1 class="hero-title">{{ T("tagline") }}</h1>
      <p class="lede">{{ T("lede") }}</p>
      <div class="actions">
        <button class="primary" :disabled="!!busy" @click="start(main)">{{ T("heroCta") }} <ArrowRight class="ic" aria-hidden="true" /></button>
        <button class="link" :disabled="!!busy" @click="start(tryIt)">{{ T("heroAlt") }}</button>
      </div>
      <div class="built">
        <span>{{ T("builtWith") }}</span>
        <span class="b">Gemini Live</span><span class="b">Gemini</span><span class="b">Firebase</span><span class="b">Firestore</span><span class="b">Cloud Run</span><span class="b">MediaPipe</span>
      </div>
    </div>
    <div class="hero-visual" aria-hidden="true">
      <span class="glow sun" />
      <span class="glow sky" />
      <div class="preview">
        <div class="phone">
          <PatientHome patient-id="budi" variant="home" />
        </div>
        <div class="preview-tag"><i />{{ T("livePreview") }}</div>
      </div>
    </div>
  </section>

  <div class="section-head">
    <h2>{{ T("scenarios") }}</h2>
    <p class="hint" style="max-width: 640px">{{ T("pickScenario") }}</p>
  </div>
  <section class="scenarios">
    <button v-for="s in scenarios" :key="s.id" class="card scenario" :class="{ main: s.main }" :disabled="!!busy" @click="start(s)">
      <span v-if="s.main" class="tag sun">{{ T("startHere") }} · {{ T("minutes", { n: s.minutes }) }}</span>
      <span v-else class="tag">{{ T("minutes", { n: s.minutes }) }} · {{ s.camera ? T("cameraOn") : T("noCamera") }}</span>
      <h3 class="scenario-title">{{ T(s.title) }}</h3>
      <p class="hint">{{ T(s.blurb) }}</p>
    </button>
  </section>

  <p class="hint" style="margin-top: 20px">
    {{ T("madeUp") }} {{ T("coachLanguage") }} {{ T("exploreHint") }} <NuxtLink to="/explore" class="link">{{ T("explore") }}</NuxtLink>
  </p>
</template>
