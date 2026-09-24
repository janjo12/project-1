import type { MicrogameKind } from "@/hooks/use-microgame";

export type GameClassId = "warrior" | "cleric" | "thief";

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
    sprite: "🤺",
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
    microgame: "multitap",
    microgameText: "Tap the circles as quickly as you can. Each hit increases your attack score.",
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    sprite: "🧙",
    support: {
      singleplayer: "Aid: Tap yourself to gain +5 Defense for 2 turns. Charge Up first to also restore 10 Health.",
      multiplayer: [
        "Aid: Tap yourself or an ally in the same room to gain +5 Defense for 2 turns.",
        "Charge Up first to also restore 10 Health.",
      ].join(" "),
    },
    special: [
      "Miracle: If you would die without a Health Potion, spend all remaining Energy",
      "and survive with Health equal to that Energy.",
    ].join(" "),
    microgame: "concentration",
    microgameText: "Tap when the filled circle perfectly fills the outline.",
  },
  thief: {
    id: "thief",
    name: "Thief",
    sprite: "🥷",
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
    microgameText: "Wait for NOW!, then tap 250 milliseconds after it appears.",
  },
};

export function randomGameClass() {
  const classIds = Object.keys(GAME_CLASSES) as GameClassId[];
  const randomIndex = Math.floor(Math.random() * classIds.length);
  return GAME_CLASSES[classIds[randomIndex]];
}

export function getGameClass(id: GameClassId) {
  return GAME_CLASSES[id];
}

export function getSupportDescription(id: GameClassId, multiplayer: boolean) {
  return GAME_CLASSES[id].support[multiplayer ? "multiplayer" : "singleplayer"];
}
