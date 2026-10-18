import type { Lang } from "./exercises";
import type { Text3 } from "./model";

/**
 * The demo cases (`cases.ts`) are written in each patient's own language, so a visitor reading the
 * app in another language would see a mix. Every seed sentence is listed here in all three languages,
 * and API responses show the one that matches the app (`localizeSeed`). Text a person types or edits
 * no longer matches a key, so it is never changed.
 */
const SEED: Text3[] = [
  // Pak Budi
  { id: "Pelan-pelan saja. Gerakan yang benar lebih penting daripada cepat.", en: "Take it slowly. Moving correctly matters more than moving fast.", zh: "慢慢来。动作正确比速度快更重要。" },
  { id: "Periksa kaki kanan setiap hari.", en: "Check the right foot every day.", zh: "每天检查右脚。" },
  { id: "Ingin bisa jalan sendiri lagi ke tempat yang ia suka.", en: "Wants to walk on his own again to the places he likes.", zh: "想重新自己走到喜欢的地方。" },
  { id: "Angkat kaki ke samping terasa berat di set kedua.", en: "Lifting the leg to the side feels heavy in the second set.", zh: "第二组侧抬腿时感觉很吃力。" },
  { id: "Suka kalau pelatih menghitung pelan-pelan.", en: "Likes the coach to count slowly.", zh: "喜欢教练慢慢数。" },
  { id: "Anak perempuannya membantu menggelar matras setiap pagi.", en: "His daughter helps roll out the mat every morning.", zh: "女儿每天早上帮他铺好垫子。" },
  { id: "malam hari", en: "at night", zh: "晚上" },
  { id: "rasa terbakar di kaki yang sudah tidak ada", en: "burning in the leg that is no longer there", zh: "已经不在的那条腿有烧灼感" },
  { id: "kesal, kemajuannya lambat", en: "frustrated, progress is slow", zh: "很烦，进步太慢" },
  { id: "Ada sedikit kemerahan di ujung kaki. Cek lagi setiap hari.", en: "There is a little redness at the end of the leg. Check it again every day.", zh: "腿的末端有一点发红。每天再检查一次。" },
  { id: "Bisa jalan sendiri lagi ke tempat yang saya suka", en: "Walk on my own again to the places I like", zh: "重新自己走到我喜欢的地方" },
  { id: "Duduk di tepi tempat tidur 5 menit tanpa dibantu", en: "Sit on the edge of the bed for 5 minutes without help", zh: "不靠帮助在床边坐 5 分钟" },
  { id: "Berdiri 1 menit dengan walker", en: "Stand for 1 minute with a walker", zh: "扶着助行器站 1 分钟" },
  { id: "Jalan 10 meter dengan walker", en: "Walk 10 metres with a walker", zh: "扶着助行器走 10 米" },
  { id: "Jalan sampai pagar depan dengan walker", en: "Walk to the front gate with a walker", zh: "扶着助行器走到前门" },
  { id: "Jalan ke ujung jalan dengan kaki palsu", en: "Walk to the end of the street with a prosthesis", zh: "装上假肢走到街尾" },
  { id: "Bermain dengan cucu di lantai", en: "Play with my grandchild on the floor", zh: "和孙子在地上玩" },
  { id: "Turun ke lantai dan bangun lagi dengan bantuan", en: "Get down to the floor and back up with help", zh: "在帮助下坐到地上再站起来" },
  { id: "Kaki yang sudah tidak ada itu rasanya seperti terbakar kalau malam, saya jadi susah tidur.", en: "The leg that's gone feels like it's burning at night, so I can't sleep well.", zh: "已经没有的那条腿晚上像在烧，我睡不好。" },
  { id: "Saya takut jadi beban buat istri saya.", en: "I'm afraid of becoming a burden on my wife.", zh: "我怕成为太太的负担。" },
  { id: "Kursi roda di rumah berat sekali, istri saya susah mendorongnya.", en: "The wheelchair at home is very heavy; my wife struggles to push it.", zh: "家里的轮椅很重，我太太推不动。" },
  { id: "Apakah Bapak sudah boleh dibonceng naik motor?", en: "Is Dad allowed to ride on the back of a motorbike yet?", zh: "爸爸现在可以坐摩托车后座了吗？" },
  // Ibu Sari
  { id: "Kemajuannya bagus! Repetisi angkat pinggul ditambah minggu ini.", en: "Great progress! More hip-lift reps this week.", zh: "进步很好！这周增加了抬臀的次数。" },
  { id: "Ingin kembali bekerja di usaha jahitnya.", en: "Wants to go back to work at her tailoring business.", zh: "想回到自己的裁缝店工作。" },
  { id: "Semangat demi anaknya yang berumur 7 tahun.", en: "Keeps going for her 7-year-old child.", zh: "为了 7 岁的孩子坚持下去。" },
  { id: "Kembali bekerja di usaha jahit saya", en: "Go back to work at my tailoring business", zh: "回到我的裁缝店工作" },
  { id: "Berdiri di meja potong 10 menit", en: "Stand at the cutting table for 10 minutes", zh: "在裁剪台前站 10 分钟" },
  { id: "Berdiri 30 menit dengan istirahat sebentar", en: "Stand for 30 minutes with short breaks", zh: "站 30 分钟，中间短暂休息" },
  { id: "Naik angkot ke toko bersama adik", en: "Take the minibus to the shop with my sister", zh: "和妹妹一起坐小巴去店里" },
  { id: "Bekerja setengah hari di toko", en: "Work half a day at the shop", zh: "在店里工作半天" },
  { id: "Bisa latihannya sore saja? Pagi saya bantu di toko.", en: "Can I exercise in the evening instead? I help at the shop in the mornings.", zh: "可以改到傍晚练习吗？我早上要在店里帮忙。" },
  // Pak Liem
  { zh: "只能扶着助行器站立。", en: "Stand only while holding the walker.", id: "Berdiri hanya sambil berpegangan pada walker." },
  { zh: "孙女每个星期天来看他。", en: "His granddaughter visits every Sunday.", id: "Cucu perempuannya menjenguk setiap hari Minggu." },
  { zh: "喜欢听老的华语歌。", en: "Likes listening to old Mandarin songs.", id: "Suka mendengarkan lagu Mandarin lama." },
  { zh: "和太太一起在公园散步", en: "Walk in the park with my wife", id: "Jalan-jalan di taman bersama istri" },
  { zh: "扶着助行器从椅子上站起来", en: "Stand up from a chair holding the walker", id: "Berdiri dari kursi sambil memegang walker" },
  { zh: "我一个人在家的时候，怕摔倒。", en: "When I'm home alone, I'm afraid of falling.", id: "Kalau sendirian di rumah, saya takut jatuh." },
  // Mas Rafi
  { id: "Minggu ini coba kancingkan baju dengan tangan kiri.", en: "This week, try buttoning your shirt with your left hand.", zh: "这周试着用左手扣衣服扣子。" },
  { id: "Ingin kembali kerja di bengkel motor.", en: "Wants to go back to work at the motorbike workshop.", zh: "想回到摩托车修理店工作。" },
  { id: "Sedang menabung untuk menikah tahun depan.", en: "Saving up to get married next year.", zh: "正在为明年结婚存钱。" },
  { id: "rasanya tangan kanan masih mengepal", en: "feels like the right hand is still clenched", zh: "感觉右手还握着拳" },
  { id: "Kembali kerja di bengkel", en: "Go back to work at the workshop", zh: "回到修理店工作" },
  { id: "Mengancingkan baju dengan tangan kiri", en: "Button my shirt with my left hand", zh: "用左手扣衣服扣子" },
  { id: "Makan sampai habis dengan tangan kiri", en: "Finish a meal with my left hand", zh: "用左手吃完一顿饭" },
  { id: "Mencoba pemasangan tangan palsu di klinik", en: "Try fitting a prosthetic hand at the clinic", zh: "在诊所试戴假手" },
];

const byText = new Map<string, Text3>();
for (const t of SEED) for (const s of Object.values(t)) byText.set(s, t);

/** The seed sentence in `lang`, or the text unchanged when it is not a seed sentence. */
export const seedText = (text: string, lang: Lang) => byText.get(text)?.[lang] ?? text;

/** Deep copy of `value` with every seed sentence shown in `lang`. */
export function localizeSeed<T>(value: T, lang: Lang): T {
  if (typeof value === "string") return seedText(value, lang) as T;
  if (Array.isArray(value)) return value.map((v) => localizeSeed(v, lang)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = localizeSeed(v, lang);
    return out as T;
  }
  return value;
}
