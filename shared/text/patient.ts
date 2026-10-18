// UI text for the patient area, merged into shared/i18n.ts. Source text is English.
import type { Lang } from "../exercises";

export const patientText = {
  // UXA-02: three welcome cards on the first open.
  welcome1Title: { en: "This is your exercise coach", id: "Ini pelatih latihan Anda", zh: "这是您的锻炼教练" },
  welcome1Body: { en: "Your physio picked today's exercises for you.", id: "Fisioterapis Anda sudah memilih latihan hari ini untuk Anda.", zh: "您的理疗师已为您选好了今天的练习。" },
  welcome2Title: { en: "It talks with you and counts your moves", id: "Ia mengobrol dengan Anda dan menghitung gerakan Anda", zh: "它会和您说话，并帮您数动作" },
  welcome2Body: { en: "With the camera, or you count out loud. Both work.", id: "Dengan kamera, atau Anda menghitung sendiri. Keduanya bisa.", zh: "可以用摄像头，也可以您自己数出声。两种都可以。" },
  welcome3Title: { en: "Ready when you are", id: "Mulai kapan pun Anda siap", zh: "您准备好了就开始" },
  welcome3Body: { en: "Today shows what to do next, one step at a time.", id: "Halaman Hari ini menunjukkan langkah berikutnya, satu per satu.", zh: "“今天”页面会一步一步告诉您接下来做什么。" },
  planWaitingTitle: { en: "Your physio is preparing your plan", id: "Fisioterapis Anda sedang menyiapkan rencana latihan", zh: "您的理疗师正在为您准备计划" },
  planWaitingBody: { en: "You'll see it here. Rest well in the meantime.", id: "Rencananya akan muncul di sini. Sementara itu, istirahatlah dengan baik.", zh: "计划准备好后会显示在这里。在此期间请好好休息。" },
  planWaitingAsk: { en: "Ask a question for your visit", id: "Ajukan pertanyaan untuk kontrol", zh: "为复诊提个问题" },
  painPickerLabel: { en: "Pain from 0 to 10", id: "Nyeri dari 0 sampai 10", zh: "疼痛 0 到 10" },
  painWordNone: { en: "None", id: "Tidak ada", zh: "不痛" },
  painWordMild: { en: "Mild", id: "Ringan", zh: "轻微" },
  painWordModerate: { en: "Moderate", id: "Sedang", zh: "中等" },
  painWordStrong: { en: "Strong", id: "Berat", zh: "严重" },
  famWelcome1Title: { en: "See how {name} is doing", id: "Lihat kabar {name}", zh: "看看{name}的情况" },
  famWelcome1Body: { en: "Today shows their exercises and how they feel, in plain words.", id: "Halaman Hari ini menunjukkan latihan dan perasaannya, dengan kata-kata sederhana.", zh: "“今天”页面用简单的话告诉您他的锻炼和感受。" },
  famWelcome2Title: { en: "Pick small tasks to help", id: "Pilih tugas kecil untuk membantu", zh: "挑一些小事来帮忙" },
  famWelcome2Body: { en: "A meal, a ride, a safer bathroom. Small things count.", id: "Masak, mengantar, kamar mandi yang lebih aman. Hal kecil itu berarti.", zh: "做顿饭、接送一趟、让浴室更安全。小事也很重要。" },
  famWelcome3Title: { en: "Ask the care team", id: "Bertanya ke tim perawatan", zh: "向医护团队提问" },
  famWelcome3Body: { en: "Write a question any time. The team answers it, at the latest at the next visit.", id: "Tulis pertanyaan kapan saja. Tim akan menjawabnya, paling lambat saat kontrol berikutnya.", zh: "随时写下问题。团队会回答，最晚在下次复诊时。" },
  welcomeNext: { en: "Next", id: "Lanjut", zh: "下一步" },
  welcomeStart: { en: "Start", id: "Mulai", zh: "开始" },
  welcomeSkip: { en: "Skip", id: "Lewati", zh: "跳过" },
  welcomeStep: { en: "Step {n} of {m}", id: "Langkah {n} dari {m}", zh: "第 {n} 步，共 {m} 步" },
} satisfies Record<string, Record<Lang, string>>;
