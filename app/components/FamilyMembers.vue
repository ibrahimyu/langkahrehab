<script setup lang="ts">
import { Camera, FileText, Home, LogOut, Pencil, Phone, PhoneCall, Plus, Save, Trash2 } from "lucide-vue-next";
import type { Lang } from "#shared/exercises";
import { locale, type TextKey } from "#shared/i18n";
import { FAMILY_MAX, type FamilyMember, type FamilyRelation } from "#shared/model";

// The Family tab (DAT-02, KEL-01, KEL-07): who is in the family (add, edit, remove with Undo),
// the hospital discharge letter for the doctor, and the way to the clinic numbers.
const props = defineProps<{ patientId: string }>();
const T = useT();
const lang = useLang();
const toast = useToast();
const { signOut } = useSession();
const { view, me, setMe, send } = useFamily(props.patientId);
const v = computed(() => view.value!);

// ---- Members ----
type Draft = { name: string; relation: FamilyRelation; lang: Lang; phone: string; livesWithPatient: boolean };
const blank = (): Draft => ({ name: "", relation: "child", lang: v.value.lang, phone: "", livesWithPatient: false });
const sheet = ref<"add" | string | null>(null);
const draft = reactive<Draft>(blank());
const saving = ref(false);
function openAdd() {
  Object.assign(draft, blank());
  sheet.value = "add";
}
function openEdit(m: FamilyMember) {
  Object.assign(draft, { name: m.name, relation: m.relation, lang: m.lang, phone: m.phone ?? "", livesWithPatient: m.livesWithPatient });
  sheet.value = m.id;
}
async function saveMember() {
  saving.value = true;
  const adding = sheet.value === "add" || !v.value.family.length;
  const ok = adding ? await send("/members", "POST", { ...draft }) : await send(`/members/${sheet.value}`, "PATCH", { ...draft });
  saving.value = false;
  if (ok !== true) return;
  if (adding) {
    toast.show(T("famMemberAdded"), { tone: "good" });
    if (!me.value || v.value.family.length === 1) setMe(v.value.family.at(-1)!.id);
  } else toast.show(T("saved"), { tone: "good", ms: 1800 });
  sheet.value = null;
  Object.assign(draft, blank());
}
async function removeMember(m: FamilyMember) {
  const taskIds = v.value.tasks.filter((t) => t.assigneeId === m.id && t.status === "open").map((t) => t.id);
  sheet.value = null;
  if ((await send(`/members/${m.id}`, "DELETE")) === true)
    toast.show(T("famMemberRemoved"), { tone: "good", undo: () => void send("/members", "POST", { ...m, taskIds }) });
}

// ---- Discharge letter (KEL-07): photo, shrunk in the browser, sent for the doctor ----
const fileInput = ref<HTMLInputElement | null>(null);
const sendingLetter = ref(false);
const images = new Map<string, string>();
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function onLetter(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  sendingLetter.value = true;
  try {
    const image = await shrink(file);
    const before = new Set(v.value.letters.map((l) => l.id));
    if ((await send("/letters", "POST", { image, by: me.value?.id })) === true) {
      const added = v.value.letters.find((l) => !before.has(l.id));
      if (added) images.set(added.id, image);
      toast.show(T("famLetterSent"), { tone: "good" });
    }
  } catch (err) {
    toast.show(errorMessage(err), { tone: "bad" });
  } finally {
    sendingLetter.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}
async function removeLetter(id: string) {
  const image = images.get(id);
  if ((await send(`/letters/${id}`, "DELETE")) === true)
    toast.show(T("famLetterRemoved"), { tone: "good", undo: image ? () => void send("/letters", "POST", { image, by: me.value?.id }) : undefined });
}
const when = (iso: string) => new Date(iso).toLocaleDateString(locale(lang.value), { day: "numeric", month: "short", year: "numeric" });
const initial = (name: string) => name.replace(/^(Bu|Pak|Ibu|Bapak)\s+/, "")[0];
</script>

<template>
  <section class="fam-members">
    <header><h1>{{ T("famYourFamily") }}</h1></header>

    <!-- Empty: one card that can be filled in right away -->
    <form v-if="!v.family.length" class="card stack" @submit.prevent="saveMember">
      <p><b>{{ T("famNoMembers") }}</b></p>
      <FamilyMemberFields v-model="draft" />
      <button class="primary big-btn" :disabled="saving || !draft.name.trim()"><Plus class="ic" aria-hidden="true" /> {{ T("famAddMember") }}</button>
    </form>

    <ul v-else class="member-list">
      <li v-for="m in v.family" :key="m.id" class="card member">
        <span class="m-avatar" aria-hidden="true">{{ initial(m.name) }}</span>
        <div class="m-info">
          <div class="m-head">
            <b>{{ m.name }} <span v-if="m.id === me?.id" class="pill">{{ T("famYou") }}</span></b>
            <button class="ghost small-btn" @click="openEdit(m)"><Pencil class="ic" aria-hidden="true" /> {{ T("edit") }}</button>
          </div>
          <span class="hint">{{ T(`rel_${m.relation}` as TextKey) }}<template v-if="m.livesWithPatient"> · <Home class="ic tiny" aria-hidden="true" /> {{ T("famLivesWith") }}</template></span>
          <a v-if="m.phone" class="link with-ic" :href="`tel:${m.phone.replace(/[^\d+]/g, '')}`"><Phone class="ic" aria-hidden="true" /> {{ m.phone }}</a>
        </div>
      </li>
    </ul>
    <button v-if="v.family.length && v.family.length < FAMILY_MAX" class="ghost" @click="openAdd"><Plus class="ic" aria-hidden="true" /> {{ T("famAddMember") }}</button>

    <section class="m-section">
      <h2>{{ T("famLetterTitle") }}</h2>
      <ul v-if="v.letters.length" class="letter-list">
        <li v-for="l in v.letters" :key="l.id" class="card letter">
          <FileText class="ic" aria-hidden="true" />
          <div class="m-info">
            <b>{{ when(l.at) }}</b>
            <span class="hint">{{ l.status === "reviewed" ? T("famLetterReviewed") : T("famLetterSent") }}</span>
          </div>
          <button v-if="l.status === 'awaiting_doctor'" class="ghost danger small-btn" @click="removeLetter(l.id)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
        </li>
      </ul>
      <label class="ghost big-btn file-btn" :class="{ busy: sendingLetter }">
        <Camera class="ic" aria-hidden="true" /> {{ T("famLetterAdd") }}
        <input ref="fileInput" type="file" accept="image/*" capture="environment" class="sr-file" :disabled="sendingLetter" @change="onLetter" />
      </label>
    </section>

    <NuxtLink :to="`/family/${patientId}/help`" class="link with-ic when-link"><PhoneCall class="ic" aria-hidden="true" /> {{ T("famWhenToCall") }}</NuxtLink>
    <button class="ghost big-btn" @click="signOut"><LogOut class="ic" aria-hidden="true" /> {{ T("switchAccount") }}</button>

    <UiSheet :open="!!sheet" :title="sheet === 'add' ? T('famAddMember') : T('famEditMember')" @close="sheet = null">
      <form class="stack" @submit.prevent="saveMember">
        <FamilyMemberFields v-model="draft" />
        <button class="primary big-btn" :disabled="saving || !draft.name.trim()"><Save class="ic" aria-hidden="true" /> {{ T("save") }}</button>
      </form>
      <button v-if="sheet && sheet !== 'add'" class="ghost danger" @click="removeMember(v.family.find((m) => m.id === sheet)!)"><Trash2 class="ic" aria-hidden="true" /> {{ T("delete") }}</button>
    </UiSheet>
  </section>
</template>

<style scoped>
.fam-members { display: grid; gap: 14px; }
.fam-members h1 { font-size: 1.625rem; }
.member-list, .letter-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.member, .letter { display: flex; align-items: center; gap: 12px; }
.member { align-items: flex-start; }
.m-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.m-info .link { white-space: nowrap; }
.m-avatar { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--dawn-soft); color: var(--dawn-ink); font: 700 1.125rem/1 var(--display); flex: none; }
.m-info { display: grid; gap: 2px; min-width: 0; flex: 1; }
.m-info .hint { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.tiny { width: 14px; height: 14px; }
.m-section { display: grid; gap: 10px; margin-top: 8px; }
.m-section h2 { font-size: 1.125rem; }
.letter > .ic { color: var(--ink-2); flex: none; }
.file-btn { position: relative; cursor: pointer; }
.file-btn.busy { opacity: 0.6; pointer-events: none; }
.sr-file { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
.when-link { justify-self: start; min-height: 44px; }
</style>
