<script setup lang="ts">
import { Phone } from "lucide-vue-next";
import { LANGS, LANG_NAMES, type Lang } from "#shared/exercises";
import type { TextKey } from "#shared/i18n";
import { FAMILY_RELATIONS, type FamilyRelation } from "#shared/model";

// The fields of one family member (DAT-02), shared by the empty card and the add/edit sheet.
const model = defineModel<{ name: string; relation: FamilyRelation; lang: Lang; phone: string; livesWithPatient: boolean }>({ required: true });
const T = useT();
</script>

<template>
  <label class="field"><span>{{ T("famName") }}</span><input v-model="model.name" maxlength="60" autocomplete="name" required /></label>
  <div class="field"><span>{{ T("famRelation") }}</span>
    <div class="chip-row" role="group" :aria-label="T('famRelation')">
      <button v-for="r in FAMILY_RELATIONS" :key="r" type="button" class="choice" :class="{ on: model.relation === r }" :aria-pressed="model.relation === r" @click="model.relation = r">{{ T(`rel_${r}` as TextKey) }}</button>
    </div>
  </div>
  <label class="field"><span class="with-ic"><Phone class="ic" aria-hidden="true" /> {{ T("phoneLabel") }}</span><input v-model="model.phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" /></label>
  <div class="field"><span>{{ T("languageLabel") }}</span>
    <div class="seg seg-full" role="group" :aria-label="T('languageLabel')">
      <button v-for="l in LANGS" :key="l" type="button" :class="{ on: model.lang === l }" @click="model.lang = l">{{ LANG_NAMES[l] }}</button>
    </div>
  </div>
  <button type="button" class="toggle" role="switch" :aria-checked="model.livesWithPatient" @click="model.livesWithPatient = !model.livesWithPatient">
    <span class="switch" :class="{ on: model.livesWithPatient }" aria-hidden="true" /> {{ T("famLivesWith") }}
  </button>
</template>

<style scoped>
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.choice { min-height: 44px; padding: 6px 16px; border-radius: var(--r-pill); border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out); }
.choice:active { transform: scale(0.97); }
.choice.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
.seg button { font-size: 0.875rem; }
</style>
