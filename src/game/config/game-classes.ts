import type { MicrogameKind } from "@/game/actions/use-microgame";

export type GameClassId = "warrior" | "cleric" | "thief" | "archer" | "wizard";

type GameClass = {
  id: GameClassId;
  name: string;
  sprite: string;
  support: {
    singleplayer: string;
    multiplayer: string;
  };
  special: string;
  microgame: MicrogameKind;
  microgameText: string;
};

export const GAME_CLASSES: Record<GameClassId, GameClass> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    sprite: "warrior_graphic",
    support: {
      singleplayer: [
        "Vanguard: Tap yourself to damage enemies when they attack you for one turn.",
        "Charge Up first to gain +5 Defense for that turn.",
      ].join(" "),
      multiplayer: [
        "Vanguard: Tap yourself or an ally in the same room to damage enemies when they attack for one turn.",
        "Charge Up first to gain +5 Defense for that turn.",
      ].join(" "),
    },
    special: "Shield: Take less damage from attacks. Warriors start with 15 Defense.",
    microgame: "multiswipe",
    microgameText: "Swipe from either dot to the other dot to complete bars. Each completed swipe is worth three taps.",
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    sprite: "cleric_graphic",
    support: {
      singleplayer: "Aid: Tap yourself to gain +5 Defense for 2 turns. Charge Up first to also restore 10 Health.",
      multiplayer: [
        "Aid: Tap yourself or an ally in the same room to gain +5 Defense for 2 turns.",
        "Charge Up first to also restore 10 Health.",
      ].join(" "),
    },
    special: "Miracle: Once per level, if you would die without a Health Potion, survive with half your maximum Health. It does not use Energy.",
    microgame: "concentration",
    microgameText: "Tap when the filled circle perfectly fills the outline.",
  },
  thief: {
    id: "thief",
    name: "Thief",
    sprite: "thief_graphic",
    support: {
      singleplayer: [
        "Enrich: Tap yourself for a 10% chance to find an item or equipment.",
        "Charge Up first for a 20% chance. Full slots make the reward fall on the ground.",
      ].join(" "),
      multiplayer: [
        "Enrich: Tap yourself or an ally in the same room for a 10% chance to find an item or equipment.",
        "Charge Up first for a 20% chance. Full slots make the reward fall on the ground.",
      ].join(" "),
    },
    special: [
      "Pick Locks: Tap a locked door to pick it without a key.",
      "Charge Up first to pick it and move through it this turn.",
    ].join(" "),
    microgame: "timed-attack",
    microgameText: "Tap...",
  },
  archer: {
    id: "archer",
    name: "Ranger",
    sprite: "archer_graphic",
    support: {
      singleplayer: "Raise Focus: Tap yourself to make microgames easier for the next 2 turns. Charge Up first to make them much easier.",
      multiplayer: "Raise Focus: Tap yourself or an ally in the same room to make microgames easier for the next 2 turns. Charge Up first to make them much easier.",
    },
    special: "Enhanced Focus: Your microgames have more forgiving scoring and a higher minimum score.",
    microgame: "multitap",
    microgameText: "Tap the circles as quickly as you can. Enhanced Focus lowers the tap requirement and guarantees a minimum score.",
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    sprite: "wizard_graphic",
    support: {
      singleplayer: "Empower Attacks: Tap yourself to gain +5 base attack damage for your next 2 turns. Charge Up first to gain +10 instead.",
      multiplayer: "Empower Attacks: Tap yourself or an ally in the same room to gain +5 base attack damage for the next 2 turns. Charge Up first to grant +10 instead.",
    },
    special: "Chain Lightning: Your base attack is 3 higher. Other enemies in the room take half the damage dealt to your chosen target, rounded down.",
    microgame: "rune-tracer",
    microgameText: "Trace the connected rune from any dot or bar. Complete it quickly for a higher score; unfinished tracing still scores by progress.",
  },
};

export function getMicrogameEaseLevel(classId: GameClassId, focusBoost = 0) {
  return Math.min(4, (classId === "archer" ? 1 : 0) + focusBoost);
}

export function randomGameClass() {
  const classIds = Object.keys(GAME_CLASSES) as GameClassId[];
  const randomIndex = Math.floor(Math.random() * classIds.length);
  return GAME_CLASSES[classIds[randomIndex]];
}

export function gameClassForSeed(seed: string) {
  const testClasses: Record<string, GameClassId> = {
    test: "warrior",
    testwarrior: "warrior",
    testthief: "thief",
    testcleric: "cleric",
    testarcher: "archer",
    testranger: "archer",
    testwizard: "wizard",
  };

  const normalizedSeed = seed.trim().toLowerCase();
  const testClass = testClasses[normalizedSeed];
  if (testClass) return getGameClass(testClass);
  return randomGameClass();
}

export function getGameClass(id: GameClassId) {
  return GAME_CLASSES[id];
}

export function getSupportDescription(id: GameClassId, multiplayer: boolean) {
  return GAME_CLASSES[id].support[multiplayer ? "multiplayer" : "singleplayer"];
}

export function getSpecialDescription(id: GameClassId) {
  return GAME_CLASSES[id].special;
}
