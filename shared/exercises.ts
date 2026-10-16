// DRAFT exercise content for testing the coach. Not clinically reviewed yet:
// a physiotherapist must review wording, doses and safety notes before real use.
// Wording is deliberately simple: short sentences, everyday words.

export const LANGS = ["id", "en", "zh"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { id: "Bahasa Indonesia", en: "English", zh: "简体中文" };
type Text = Record<Lang, string>;

export type Exercise = {
  id: string;
  name: Text;
  /** A few short sentences the coach can use to explain the movement. */
  instructions: Text;
  /** The words the coach says during each rep, in order (e.g. lift, hold, lower). */
  tempo: Text;
  sets: number;
  reps: number;
  holdSeconds: number;
  restSeconds: number;
};

export const exercises: Exercise[] = [
  {
    id: "bridging",
    name: { en: "Bridging", id: "Angkat pinggul (bridging)", zh: "臀桥" },
    instructions: {
      en: "Lie on your back with your good knee bent. Rest your amputated leg on a rolled towel. Squeeze your bottom and lift your hips. Hold, then lower slowly.",
      id: "Berbaring telentang, lutut kaki yang sehat ditekuk. Taruh kaki yang diamputasi di atas handuk gulung. Kencangkan bokong, angkat pinggul. Tahan, lalu turunkan pelan-pelan.",
      zh: "平躺，好腿的膝盖弯起来。截肢的那条腿放在卷起的毛巾上。夹紧屁股，把臀部抬起来。停一下，再慢慢放下。",
    },
    tempo: { en: "lift, hold, lower", id: "angkat, tahan, turun", zh: "抬起，停住，放下" },
    sets: 2,
    reps: 10,
    holdSeconds: 3,
    restSeconds: 30,
  },
  {
    id: "side-lying-abduction",
    name: { en: "Side leg lift", id: "Angkat kaki ke samping", zh: "侧躺抬腿" },
    instructions: {
      en: "Lie on your side with your amputated leg on top. Lift that leg up towards the ceiling. Hold, then lower slowly.",
      id: "Berbaring miring, kaki yang diamputasi di atas. Angkat kaki itu ke atas. Tahan, lalu turunkan pelan-pelan.",
      zh: "侧躺，截肢的那条腿在上面。把这条腿往上抬。停一下，再慢慢放下。",
    },
    tempo: { en: "lift, hold, lower", id: "angkat, tahan, turun", zh: "抬起，停住，放下" },
    sets: 2,
    reps: 10,
    holdSeconds: 2,
    restSeconds: 30,
  },
  {
    id: "prone-hip-extension",
    name: { en: "Back leg lift (on your stomach)", id: "Angkat kaki ke belakang (tengkurap)", zh: "趴着抬腿" },
    instructions: {
      en: "Lie on your stomach. Keep your amputated leg straight and lift it a little off the floor. Hold, then lower slowly. Keep your hips down.",
      id: "Berbaring tengkurap. Luruskan kaki yang diamputasi, angkat sedikit dari lantai. Tahan, lalu turunkan pelan-pelan. Pinggul tetap di lantai.",
      zh: "趴下。截肢的那条腿伸直，从地上稍微抬起来。停一下，再慢慢放下。屁股贴着地面。",
    },
    tempo: { en: "lift, hold, lower", id: "angkat, tahan, turun", zh: "抬起，停住，放下" },
    sets: 2,
    reps: 10,
    holdSeconds: 3,
    restSeconds: 30,
  },
  {
    id: "sit-to-stand",
    name: { en: "Sit to stand", id: "Duduk lalu berdiri", zh: "扶着站起来" },
    instructions: {
      en: "Sit at the front of a strong chair with a walker in front of you. Lean forward and push up to stand. Then sit down slowly.",
      id: "Duduk di ujung kursi yang kuat, walker di depan Anda. Condongkan badan ke depan, lalu dorong untuk berdiri. Duduk lagi pelan-pelan.",
      zh: "坐在结实椅子的前边，助行器放在前面。身体往前倾，用力站起来。再慢慢坐下。",
    },
    tempo: { en: "stand, sit", id: "berdiri, duduk", zh: "站起，坐下" },
    sets: 2,
    reps: 8,
    holdSeconds: 0,
    restSeconds: 45,
  },
];

export const exerciseById = (id: string) => exercises.find((e) => e.id === id);
