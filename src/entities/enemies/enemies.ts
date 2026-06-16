import { createSeededRandom } from "@/utils/dungeon-map";

import type { Enemy } from "./types";

export const ENEMIES: Enemy[] = [
  { emoji: "\uD83D\uDC7E", hitPoints: 3, name: "Glitch Imp" },
  { emoji: "\uD83E\uDDDF", hitPoints: 3, name: "Crypt Stumbler" },
  { emoji: "\uD83D\uDC09", hitPoints: 3, name: "Tiny Dragon" },
  { emoji: "\uD83E\uDDDB", hitPoints: 3, name: "Night Count" },
];

export const WEREWOLF: Enemy = {
  emoji: "\uD83D\uDC3A",
  hitPoints: 1,
  name: "Werewolf",
};

export function getSeededEnemyRoster(seed: string) {
  const random = createSeededRandom(seed);
  const roster = [...ENEMIES];

  for (let index = roster.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [roster[index], roster[swapIndex]] = [roster[swapIndex], roster[index]];
  }

  return roster;
}
