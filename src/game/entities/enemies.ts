import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export type WorldMonster = {
  attack?: number;
  defense?: number;
  currentHealth: number;
  damage: number;
  id: string;
  chases?: boolean;
  maximumHealth: number;
  name: string;
  sprite: string;
  type: "monster";
};

export const POSSIBLE_MONSTERS: Omit<WorldMonster, "currentHealth" | "id">[] =
  GAME_PARAMETERS.monsters.map((monster) => ({ ...monster, type: "monster" as const }));

export function createMonster(index: number, roomId: string, random: () => number): WorldMonster {
  // Cycle through ordinary monster types while using the seeded stream for unique stable IDs.
  const monsters = POSSIBLE_MONSTERS.filter((monster) => !monster.chases);
  const monster = monsters[index % monsters.length];
  return {
    ...monster,
    currentHealth: monster.maximumHealth,
    id: `${roomId}:monster:${index}:${Math.floor(random() * 1_000_000)}`,
  };
}

export function createWerewolf(roomId: string): WorldMonster {
  // The chasing monster has one deterministic identity per room for save/map references.
  const werewolf = POSSIBLE_MONSTERS.find((monster) => monster.chases)!;
  return { ...werewolf, currentHealth: werewolf.maximumHealth, id: `${roomId}:werewolf` };
}
