// UI text for the platform area, merged into shared/i18n.ts. Source text is English.
import type { Lang } from "../exercises";

export const platformText = {
  // SYS-11: notification and email text. Summary words only: never pain numbers, diary text or quotes.
  ntfOpen: { en: "Open Langkah", id: "Buka Langkah", zh: "打开 Langkah" },
  ntf_exercise_reminder: { en: "Time for today's exercises", id: "Waktunya latihan hari ini", zh: "该做今天的练习了" },
  ntf_exercise_reminder_body: { en: "Your exercises take about {min} minutes. Start whenever you are ready.", id: "Latihan Anda sekitar {min} menit. Mulai kapan pun Anda siap.", zh: "练习大约需要 {min} 分钟。准备好了就开始吧。" },
  ntf_gentle_return: { en: "We saved your place", id: "Latihan Anda tetap tersimpan", zh: "我们为您保留了进度" },
  ntf_gentle_return_body: { en: "Whenever you feel ready, a short session is a good way back.", id: "Kapan pun Anda siap, sesi singkat adalah cara yang baik untuk kembali.", zh: "等您准备好时，做一次短练习就是很好的开始。" },
  ntf_visit_tomorrow: { en: "Clinic visit tomorrow", id: "Kunjungan klinik besok", zh: "明天有门诊复诊" },
  ntf_visit_tomorrow_body: { en: "A clinic visit is planned for tomorrow. Open Langkah to see the time and what to bring.", id: "Kunjungan klinik dijadwalkan besok. Buka Langkah untuk melihat jam dan apa yang perlu dibawa.", zh: "明天安排了门诊复诊。打开 Langkah 查看时间和需要携带的东西。" },
  ntf_question_answered: { en: "Your question has an answer", id: "Pertanyaan Anda sudah dijawab", zh: "您的问题已有回复" },
  ntf_question_answered_body: { en: "The care team answered a question. Open Langkah to read it.", id: "Tim perawatan sudah menjawab pertanyaan. Buka Langkah untuk membacanya.", zh: "医护团队回复了一个问题。打开 Langkah 查看。" },
  ntf_family_task: { en: "A new way to help", id: "Ada tugas baru untuk membantu", zh: "有一项新的帮忙任务" },
  ntf_family_task_body: { en: "New task: {task}.", id: "Tugas baru: {task}.", zh: "新任务：{task}。" },
  ntf_family_weekly: { en: "This week with {name}", id: "Minggu ini bersama {name}", zh: "{name} 这一周" },
  ntf_family_weekly_body: { en: "A short summary of {name}'s week is ready.", id: "Ringkasan singkat minggu {name} sudah siap.", zh: "{name} 本周的简短总结已准备好。" },
  ntf_alert_urgent: { en: "Urgent: {name} needs the care team", id: "Mendesak: {name} perlu tim perawatan", zh: "紧急：{name} 需要医护团队" },
  ntf_alert_urgent_body: { en: "An urgent alert about {name} is open. Open Langkah to review it.", id: "Ada peringatan mendesak tentang {name}. Buka Langkah untuk meninjaunya.", zh: "有一条关于 {name} 的紧急提醒。打开 Langkah 查看。" },
  ntf_daily_digest: { en: "Today: {n} patients need you", id: "Hari ini: {n} pasien perlu Anda", zh: "今天：{n} 位患者需要您" },
  ntf_daily_digest_body: { en: "{n} patients have open alerts for you this morning.", id: "{n} pasien punya peringatan terbuka untuk Anda pagi ini.", zh: "今天早上有 {n} 位患者有给您的未处理提醒。" },
  ntf_proposal_pending: { en: "A progression proposal waits", id: "Usulan progres menunggu", zh: "有一项进阶建议待处理" },
  ntf_proposal_pending_body: { en: "A plan progression for {name} waits for your decision.", id: "Usulan progres rencana untuk {name} menunggu keputusan Anda.", zh: "{name} 的计划进阶建议等待您决定。" },
  ntf_journey_step: { en: "Good news about {name}", id: "Kabar baik tentang {name}", zh: "关于 {name} 的好消息" },
  ntf_journey_step_body: { en: "{name} has reached a new step on the recovery journey.", id: "{name} sudah sampai di tahap baru dalam perjalanan pemulihan.", zh: "{name} 的康复之路迈入了新的阶段。" },

  // FIS-08 / DAT-07: activity feed lines.
  act_daily: { en: "Daily check: {alerts} alerts, {proposals} proposal, {briefs} brief prepared", id: "Cek harian: {alerts} peringatan, {proposals} usulan, {briefs} brief disiapkan", zh: "每日检查：{alerts} 条提醒，{proposals} 项建议，{briefs} 份简报已准备" },
  act_readiness: { en: "Marked {criterion}: {status}", id: "Menandai {criterion}: {status}", zh: "标记 {criterion}：{status}" },
  act_cleared: { en: "Cleared for prosthesis fitting", id: "Dinyatakan siap pemasangan prostesis", zh: "已批准装配假肢" },
  act_cleared_undone: { en: "Took back the fitting clearance", id: "Membatalkan izin pemasangan prostesis", zh: "撤回了假肢装配批准" },
  act_goal_reached: { en: "Walking toward the goal", id: "Berjalan menuju tujuan", zh: "正朝目标行走" },
  act_goal_undone: { en: "Took back \"walking toward the goal\"", id: "Membatalkan \"berjalan menuju tujuan\"", zh: "撤回了“正朝目标行走”" },
  act_stage: { en: "Journey step {from} → {to}", id: "Tahap perjalanan {from} → {to}", zh: "康复阶段 {from} → {to}" },
  act_tasks_rule: { en: "Added {n} family tasks", id: "Menambah {n} tugas keluarga", zh: "新增 {n} 项家人任务" },
  act_next: { en: "Next step for the patient: {kind}", id: "Langkah berikutnya untuk pasien: {kind}", zh: "患者的下一步：{kind}" },
  act_checkin_done: { en: "Recorded the visit", id: "Mencatat kunjungan", zh: "记录了复诊" },
  act_checkin_booked: { en: "Booked a visit for {date}", id: "Menjadwalkan kunjungan pada {date}", zh: "预约了 {date} 的复诊" },
  act_question_answered: { en: "Answered a question", id: "Menjawab pertanyaan", zh: "回答了一个问题" },
  act_family_update: { en: "Wrote the weekly family update", id: "Menulis kabar mingguan keluarga", zh: "撰写了每周家人简报" },
  act_brief_auto: { en: "Prepared the brief for tomorrow's visit", id: "Menyiapkan brief untuk kunjungan besok", zh: "为明天的复诊准备了简报" },
} satisfies Record<string, Record<Lang, string>>;
