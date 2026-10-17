// Family task templates (KEL-03). Tasks are never written by AI: they come from this list, which the
// care team approves, and rules pick them from the patient's profile. Free first, then borrow, then buy.
// CLINICAL_REVIEW_NEEDED marks templates that touch movement: a clinician must check the wording.

import type { TaskCategory, TaskCost, Text3 } from "./model";

export type TaskTemplate = {
  id: string;
  category: TaskCategory;
  cost: TaskCost;
  title: Text3;
  detail: Text3;
  /** Can come back after it was done (weekly, per visit). */
  repeats?: "weekly" | "per_visit";
  /** CLINICAL_REVIEW_NEEDED: the wording touches movement or weight-bearing. */
  clinicalReview?: true;
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "clear_walkway",
    category: "home_safety",
    cost: "free",
    title: { en: "Clear the path from bed to bathroom", id: "Kosongkan jalur dari tempat tidur ke kamar mandi", zh: "清理从床到卫生间的通道" },
    detail: {
      en: "Move loose mats, cables and small furniture out of the way. A clear path is the simplest way to prevent falls.",
      id: "Singkirkan keset yang licin, kabel, dan perabot kecil. Jalur yang lapang adalah cara paling mudah mencegah jatuh.",
      zh: "移开松动的地垫、电线和小家具。通道畅通是防止跌倒最简单的方法。",
    },
  },
  {
    id: "night_light",
    category: "home_safety",
    cost: "free",
    title: { en: "Leave a light on at night", id: "Nyalakan lampu kecil di malam hari", zh: "夜里留一盏灯" },
    detail: {
      en: "A lamp you already have, near the bed or in the hallway, so the way to the bathroom is never dark.",
      id: "Pakai lampu yang sudah ada, di dekat tempat tidur atau lorong, supaya jalan ke kamar mandi tidak gelap.",
      zh: "用家里现有的灯，放在床边或走廊，让去卫生间的路不再黑暗。",
    },
  },
  {
    id: "bathroom_mat",
    category: "home_safety",
    cost: "borrow",
    title: { en: "Put a non-slip mat in the bathroom", id: "Pasang keset anti-licin di kamar mandi", zh: "在卫生间铺防滑垫" },
    detail: {
      en: "Borrow one from a neighbour or relative first; buy one only if no one has a spare.",
      id: "Coba pinjam dari tetangga atau saudara dulu; beli hanya kalau tidak ada yang punya.",
      zh: "先向邻居或亲戚借；没有多余的再买。",
    },
  },
  {
    id: "chair_with_arms",
    category: "equipment",
    cost: "free",
    title: { en: "Set out a sturdy chair with armrests", id: "Siapkan kursi kokoh yang ada sandaran tangannya", zh: "准备一把带扶手的结实椅子" },
    detail: {
      en: "Use a chair you already have. Put it against a wall so it cannot slide.",
      id: "Pakai kursi yang sudah ada. Letakkan menempel ke dinding supaya tidak bergeser.",
      zh: "用家里现有的椅子，靠墙放好，防止滑动。",
    },
    clinicalReview: true,
  },
  {
    id: "borrow_walker",
    category: "equipment",
    cost: "borrow",
    title: { en: "Find a walker to borrow", id: "Cari walker yang bisa dipinjam", zh: "找一个可以借用的助行器" },
    detail: {
      en: "Ask the clinic, the mosque or church, or neighbours. Let the physio check the height before using it.",
      id: "Tanyakan ke klinik, masjid atau gereja, atau tetangga. Minta fisioterapis memeriksa tingginya sebelum dipakai.",
      zh: "可以问诊所、清真寺或教堂、邻居。使用前请物理治疗师调好高度。",
    },
    clinicalReview: true,
  },
  {
    id: "other_foot_photo",
    category: "other_foot",
    cost: "free",
    title: { en: "Help take a photo of the other foot", id: "Bantu memotret kaki yang satunya", zh: "帮忙拍一张另一只脚的照片" },
    detail: {
      en: "Once a week, in good light: the sole, the toes and between the toes. Use the skin check in the app.",
      id: "Seminggu sekali, di tempat terang: telapak, jari, dan sela-sela jari. Pakai cek kulit di aplikasi.",
      zh: "每周一次，光线充足：脚底、脚趾和趾缝。用应用里的皮肤检查。",
    },
    repeats: "weekly",
  },
  {
    id: "check_shoes",
    category: "other_foot",
    cost: "free",
    title: { en: "Check the inside of the shoes", id: "Periksa bagian dalam sepatu", zh: "检查鞋子里面" },
    detail: {
      en: "Feel inside for small stones or rough seams before the shoes go on.",
      id: "Raba bagian dalam, cari batu kecil atau jahitan kasar sebelum sepatu dipakai.",
      zh: "穿鞋前用手摸一下里面，看有没有小石子或粗糙的缝线。",
    },
  },
  {
    id: "sit_with_during_session",
    category: "company",
    cost: "free",
    title: { en: "Keep them company during one exercise session", id: "Temani saat satu sesi latihan", zh: "陪伴一次练习" },
    detail: {
      en: "Just be there. No need to count or correct: the app does that.",
      id: "Cukup hadir. Tidak perlu menghitung atau mengoreksi: aplikasi yang melakukannya.",
      zh: "陪在身边就好。不用数数或纠正，应用会做。",
    },
    repeats: "weekly",
    clinicalReview: true,
  },
  {
    id: "bpjs_documents",
    category: "admin",
    cost: "free",
    title: { en: "Keep the insurance papers in one folder", id: "Kumpulkan berkas BPJS dalam satu map", zh: "把医保材料放进一个文件夹" },
    detail: {
      en: "ID card, family card, insurance card and hospital letters. Ask the clinic which copies they need.",
      id: "KTP, KK, kartu BPJS, dan surat dari rumah sakit. Tanyakan ke klinik salinan apa saja yang diperlukan.",
      zh: "身份证、户口本、医保卡和医院的信件。问问诊所需要哪些复印件。",
    },
  },
  {
    id: "bring_questions",
    category: "visit",
    cost: "free",
    title: { en: "Gather questions for the next visit", id: "Kumpulkan pertanyaan untuk kontrol berikutnya", zh: "整理下次复诊要问的问题" },
    detail: {
      en: "Add them under Questions in this app, so the doctor sees them before the visit.",
      id: "Tulis di bagian Pertanyaan di aplikasi ini, supaya dokter melihatnya sebelum kontrol.",
      zh: "写在本应用的「问题」里，医生在复诊前就能看到。",
    },
    repeats: "per_visit",
  },
];

export const templateById = (id: string | null | undefined) => TASK_TEMPLATES.find((t) => t.id === id);
