// "Understand my recovery" (PAS-16): short cards per topic, rewritten in plain words from patient
// information by clinical bodies. Only well-established, conservative advice; nothing about doses,
// dates or individual decisions (those belong to the care team). Not free AI text: the coach and
// Talk with Langkah may point to a card by id, never rewrite it. Should be reviewed by a physio.
// Sources:
//  - NHS (nhs.uk): Amputation, recovery and complications pages; Diabetes, foot care.
//  - BACPAR: British Association of Chartered Physiotherapists in Amputee Rehabilitation, patient guidance.
//  - WHO Standards for Prosthetics and Orthotics (2017).

import type { Lang } from "./exercises";

type L = Record<Lang, string>;

export const RECOVERY_TOPICS = ["healing", "swelling", "exercise", "phantom", "skin", "other_leg", "prosthesis", "feelings"] as const;
export type RecoveryTopic = (typeof RECOVERY_TOPICS)[number];

export type RecoveryCard = {
  id: RecoveryTopic;
  /** Journey steps (PAS-03, 1 to 5) this card belongs to most. */
  steps: number[];
  title: L;
  /** One line under the title in the list. */
  lede: L;
  /** What happens, why it matters, what is normal. Short sentences. */
  points: L[];
  /** When to contact the clinic. */
  call: L;
  source: string;
};

export const recoveryCards: RecoveryCard[] = [
  {
    id: "healing",
    steps: [1],
    title: { en: "Wound healing", id: "Penyembuhan luka", zh: "伤口愈合" },
    lede: { en: "How the wound heals, and how to help it.", id: "Bagaimana luka sembuh, dan cara membantunya.", zh: "伤口如何愈合，以及怎样帮助它。" },
    points: [
      { en: "A wound usually takes some weeks to heal. Your care team checks it at each visit.", id: "Luka biasanya butuh beberapa minggu untuk sembuh. Tim perawat memeriksanya setiap kontrol.", zh: "伤口通常需要几周才能愈合。护理团队每次复查都会检查。" },
      { en: "Keep the dressing clean and dry, the way your nurse showed you.", id: "Jaga perban tetap bersih dan kering, seperti yang diajarkan perawat.", zh: "按照护士教您的方法，保持敷料清洁干燥。" },
      { en: "Eating well, with enough protein, helps the skin heal. Not smoking helps too.", id: "Makan cukup, dengan protein yang cukup, membantu kulit sembuh. Tidak merokok juga membantu.", zh: "吃好饭、摄入足够的蛋白质有助于伤口愈合。不吸烟也有帮助。" },
    ],
    call: { en: "Call your clinic if the redness spreads, the wound gets hot, more swollen, smells, leaks, opens, or you have a fever.", id: "Hubungi klinik kalau kemerahan meluas, luka terasa panas, makin bengkak, berbau, keluar cairan, terbuka, atau Bapak/Ibu demam.", zh: "如果红肿扩大、伤口发热、更肿、有异味、渗液、裂开，或您发烧，请联系诊所。" },
    source: "NHS: Amputation, recovery",
  },
  {
    id: "swelling",
    steps: [1, 2],
    title: { en: "Swelling and shape", id: "Bengkak dan bentuk kaki", zh: "肿胀和腿的形状" },
    lede: { en: "Why your leg changes size in the first months.", id: "Kenapa ukuran kaki berubah di bulan-bulan pertama.", zh: "为什么头几个月腿的大小会变化。" },
    points: [
      { en: "Swelling after surgery is normal. It goes down slowly over weeks and months.", id: "Bengkak setelah operasi itu wajar. Bengkaknya turun pelan-pelan dalam beberapa minggu sampai bulan.", zh: "手术后肿胀是正常的，会在几周到几个月内慢慢消退。" },
      { en: "As it goes down, the size and shape of your leg change. That is why a prosthesis is fitted later, and adjusted.", id: "Saat bengkak turun, ukuran dan bentuk kaki ikut berubah. Karena itu prostesis dipasang belakangan, lalu disesuaikan.", zh: "肿胀消退时，腿的大小和形状会改变。所以假肢要晚些安装，并需要调整。" },
      { en: "If your team gives you a compression sock or bandage, wear it the way they showed you. Your exercises help the swelling go down.", id: "Kalau tim memberi kaus kompresi atau perban, pakailah seperti yang diajarkan. Latihan juga membantu bengkak turun.", zh: "如果团队给了您压力袜或绷带，请按教您的方法穿戴。锻炼也有助于消肿。" },
    ],
    call: { en: "Call your clinic if the swelling suddenly gets worse, feels hot, or the sock leaves marks that do not fade.", id: "Hubungi klinik kalau bengkak tiba-tiba bertambah, terasa panas, atau kaus kompresi meninggalkan bekas yang tidak hilang.", zh: "如果肿胀突然加重、发热，或压力袜留下的印子不消退，请联系诊所。" },
    source: "NHS: Amputation, recovery · BACPAR patient guidance",
  },
  {
    id: "exercise",
    steps: [2, 3],
    title: { en: "Why the exercises matter", id: "Kenapa latihan itu penting", zh: "为什么锻炼很重要" },
    lede: { en: "Strong muscles and loose joints get you ready to walk.", id: "Otot kuat dan sendi lentur menyiapkan Bapak/Ibu untuk berjalan.", zh: "强壮的肌肉和灵活的关节，为走路做好准备。" },
    points: [
      { en: "Exercises make your hip, knee and body muscles stronger. You will need them to stand and walk with a prosthesis.", id: "Latihan menguatkan otot pinggul, lutut, dan badan. Otot ini dibutuhkan untuk berdiri dan berjalan dengan prostesis.", zh: "锻炼能增强髋部、膝部和躯干的肌肉。站立和用假肢走路都需要它们。" },
      { en: "Moving every day keeps your joints from getting stiff.", id: "Bergerak setiap hari menjaga sendi supaya tidak kaku.", zh: "每天活动可以防止关节变僵硬。" },
      { en: "When you rest, keep your leg straight. Do not put a pillow under your knee or between your legs.", id: "Saat istirahat, luruskan kaki. Jangan taruh bantal di bawah lutut atau di antara kedua kaki.", zh: "休息时请把腿伸直。不要在膝盖下面或两腿之间垫枕头。" },
      { en: "Move slowly. If it hurts, stop and tell your physio.", id: "Bergerak pelan-pelan. Kalau sakit, berhenti dan beri tahu fisioterapis.", zh: "动作要慢。如果疼，请停下并告诉您的理疗师。" },
    ],
    call: { en: "Call your clinic if an exercise causes sharp pain, or pain that lasts after you rest.", id: "Hubungi klinik kalau latihan menimbulkan nyeri tajam, atau nyeri yang tidak hilang setelah istirahat.", zh: "如果锻炼引起剧痛，或休息后疼痛仍不消失，请联系诊所。" },
    source: "BACPAR patient guidance",
  },
  {
    id: "phantom",
    steps: [1, 2, 3, 4, 5],
    title: { en: "Phantom feelings", id: "Rasa kaki bayangan", zh: "幻肢感" },
    lede: { en: "It is real, and it is common.", id: "Itu nyata, dan banyak yang mengalaminya.", zh: "这是真实的，也很常见。" },
    points: [
      { en: "Many people still feel their leg after surgery: an itch, tingling, its position, and sometimes pain. It comes from the nerves and the brain. It is real.", id: "Banyak orang masih merasakan kakinya setelah operasi: gatal, kesemutan, posisinya, kadang nyeri. Rasa ini berasal dari saraf dan otak. Ini nyata.", zh: "很多人手术后仍能感觉到那条腿：发痒、刺麻、它的位置，有时还会痛。这来自神经和大脑，是真实的感觉。" },
      { en: "For many people it becomes less over time.", id: "Pada banyak orang, rasa ini berkurang seiring waktu.", zh: "对很多人来说，这种感觉会随着时间减轻。" },
      { en: "Things that can help: moving and your exercises, gently touching the leg once it has healed, and treatments your team can offer.", id: "Yang bisa membantu: bergerak dan latihan, menyentuh kaki dengan lembut setelah sembuh, dan perawatan yang bisa diberikan tim.", zh: "可能有帮助的方法：活动和锻炼、伤口愈合后轻轻抚摸腿，以及团队能提供的治疗。" },
      { en: "At night the leg can feel as if it is there. Sit up slowly and use your aids before you stand.", id: "Di malam hari kaki bisa terasa seperti masih ada. Duduk pelan-pelan dan pakai alat bantu sebelum berdiri.", zh: "夜里可能会觉得腿还在。请慢慢坐起，用好辅助器具后再站起来。" },
    ],
    call: { en: "Tell your team if the pain stops you sleeping or doing your day. It can be treated.", id: "Beri tahu tim kalau nyerinya mengganggu tidur atau kegiatan harian. Nyeri ini bisa diobati.", zh: "如果疼痛影响睡眠或日常生活，请告诉团队。这是可以治疗的。" },
    source: "NHS: Amputation, complications",
  },
  {
    id: "skin",
    steps: [2, 3, 4, 5],
    title: { en: "Skin care", id: "Perawatan kulit", zh: "皮肤护理" },
    lede: { en: "A few minutes a day keeps the skin healthy.", id: "Beberapa menit sehari menjaga kulit tetap sehat.", zh: "每天几分钟，保持皮肤健康。" },
    points: [
      { en: "Look at the skin of your leg every day. A mirror or someone you trust can help.", id: "Lihat kulit kaki setiap hari. Cermin atau orang yang Bapak/Ibu percaya bisa membantu.", zh: "每天检查腿上的皮肤。可以用镜子，或请信任的人帮忙。" },
      { en: "Wash it with mild soap and water, and dry it well, also in the skin folds.", id: "Cuci dengan sabun lembut dan air, lalu keringkan dengan baik, termasuk di lipatan kulit.", zh: "用温和的肥皂和清水清洗，并彻底擦干，包括皮肤褶皱处。" },
      { en: "Use a clean sock or liner every day.", id: "Pakai kaus kaki atau liner yang bersih setiap hari.", zh: "每天换干净的袜套或内衬。" },
    ],
    call: { en: "Call your clinic for a blister, broken skin, a rash, or a red mark that does not fade.", id: "Hubungi klinik kalau ada lepuh, kulit lecet, ruam, atau tanda merah yang tidak hilang.", zh: "如果出现水泡、破皮、皮疹，或红印不消退，请联系诊所。" },
    source: "NHS: Amputation, recovery · BACPAR patient guidance",
  },
  {
    id: "other_leg",
    steps: [1, 2, 3, 4, 5],
    title: { en: "Looking after your other leg", id: "Menjaga kaki yang satunya", zh: "照顾另一条腿" },
    lede: { en: "It is working harder now. Look after it.", id: "Kaki ini sekarang bekerja lebih keras. Jagalah.", zh: "它现在更辛苦了，请好好照顾它。" },
    points: [
      { en: "Check your foot every day for cuts, blisters, or changes in colour.", id: "Periksa telapak dan punggung kaki setiap hari: luka, lepuh, atau perubahan warna.", zh: "每天检查脚上有没有伤口、水泡或颜色变化。" },
      { en: "Wear shoes that fit well, and do not walk barefoot.", id: "Pakai sepatu yang pas, dan jangan berjalan tanpa alas kaki.", zh: "穿合脚的鞋，不要赤脚走路。" },
      { en: "If you have diabetes, go to your regular foot checks.", id: "Kalau Bapak/Ibu punya diabetes, datanglah ke pemeriksaan kaki rutin.", zh: "如果您有糖尿病，请按时去做足部检查。" },
    ],
    call: { en: "Call your clinic for a wound that does not heal, a change in colour, warmth, or new pain in that foot.", id: "Hubungi klinik kalau ada luka yang tidak sembuh, perubahan warna, terasa panas, atau nyeri baru di kaki itu.", zh: "如果那只脚有不愈合的伤口、颜色变化、发热或新的疼痛，请联系诊所。" },
    source: "NHS: Diabetes, foot care",
  },
  {
    id: "prosthesis",
    steps: [3, 4],
    title: { en: "When a prosthesis can be fitted", id: "Kapan prostesis bisa dipasang", zh: "什么时候可以装假肢" },
    lede: { en: "What comes first, and what the fitting is like.", id: "Apa yang perlu siap dulu, dan seperti apa pemasangannya.", zh: "需要先准备什么，以及安装是什么样的。" },
    points: [
      { en: "Your team decides the right time together with you. It is different for everyone.", id: "Tim menentukan waktu yang tepat bersama Bapak/Ibu. Waktunya berbeda untuk setiap orang.", zh: "团队会和您一起决定合适的时间。每个人都不一样。" },
      { en: "Usually the wound has healed and the swelling has gone down first. This often takes some weeks or months.", id: "Biasanya luka sudah sembuh dan bengkak sudah turun lebih dulu. Ini sering butuh beberapa minggu atau bulan.", zh: "通常要先等伤口愈合、肿胀消退。这往往需要几周或几个月。" },
      { en: "The fitting has steps: measuring or a cast, trying it on, small changes, and then learning to walk with your physio.", id: "Pemasangan ada tahapnya: diukur atau dicetak, dicoba, disesuaikan sedikit demi sedikit, lalu belajar berjalan bersama fisioterapis.", zh: "安装分几步：测量或取模、试穿、逐步调整，然后在理疗师指导下学走路。" },
      { en: "The exercises you do now prepare your body for this.", id: "Latihan yang Bapak/Ibu lakukan sekarang menyiapkan tubuh untuk tahap ini.", zh: "您现在做的锻炼，就是在为这一步做准备。" },
    ],
    call: { en: "Tell your team if the prosthesis rubs, hurts, or feels loose or tight.", id: "Beri tahu tim kalau prostesis terasa menggesek, sakit, terlalu longgar, atau terlalu sempit.", zh: "如果假肢摩擦、疼痛、太松或太紧，请告诉团队。" },
    source: "WHO Standards for Prosthetics and Orthotics (2017) · NHS: Amputation, recovery",
  },
  {
    id: "feelings",
    steps: [1, 2, 3, 4, 5],
    title: { en: "Your feelings", id: "Perasaan Bapak/Ibu", zh: "您的心情" },
    lede: { en: "Every feeling is welcome here.", id: "Semua perasaan boleh ada.", zh: "每一种感受都值得被接纳。" },
    points: [
      { en: "Many people feel a mix of things after surgery: relief, worry, anger, sadness. All of these are common.", id: "Banyak orang merasakan campuran perasaan setelah operasi: lega, cemas, marah, sedih. Semuanya wajar.", zh: "很多人手术后心情复杂：松了口气、担心、生气、难过。这些都很常见。" },
      { en: "Feelings often get easier with time and with support.", id: "Perasaan sering menjadi lebih ringan seiring waktu dan dukungan.", zh: "随着时间和身边人的支持，心情往往会慢慢好起来。" },
      { en: "Talking helps: with family, a friend, your care team, or someone who has been through the same.", id: "Bercerita membantu: dengan keluarga, teman, tim perawat, atau orang yang pernah mengalami hal yang sama.", zh: "说出来会有帮助：和家人、朋友、护理团队，或有相同经历的人聊聊。" },
    ],
    call: { en: "If you feel low most days for two weeks or more, tell your team. If you have thoughts of harming yourself, get help right away.", id: "Kalau Bapak/Ibu merasa murung hampir setiap hari selama dua minggu atau lebih, beri tahu tim. Kalau muncul pikiran untuk menyakiti diri, segera cari bantuan.", zh: "如果两周或更长时间里大多数日子都情绪低落，请告诉团队。如果有伤害自己的念头，请立即求助。" },
    source: "NHS: Amputation, recovery",
  },
];

export const recoveryCard = (id: string) => recoveryCards.find((c) => c.id === id);

/** Everything on a card in one string, for read aloud. */
export const cardText = (c: RecoveryCard, lang: Lang, callLabel: string) => [c.title[lang], c.lede[lang], ...c.points.map((p) => p[lang]), `${callLabel}: ${c.call[lang]}`].join(" ");
