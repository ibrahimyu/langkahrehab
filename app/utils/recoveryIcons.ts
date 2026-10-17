import type { Component } from "vue";
import { Bandage, Droplets, Dumbbell, Footprints, HeartHandshake, PersonStanding, ShieldCheck, Waves } from "lucide-vue-next";
import type { RecoveryTopic } from "#shared/recovery";

/** One icon per "Understand my recovery" topic (PAS-16), shared by the Learn pages and Talk. */
export const recoveryIcons: Record<RecoveryTopic, Component> = {
  healing: Bandage,
  swelling: Droplets,
  exercise: Dumbbell,
  phantom: Waves,
  skin: ShieldCheck,
  other_leg: Footprints,
  prosthesis: PersonStanding,
  feelings: HeartHandshake,
};
