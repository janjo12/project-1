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

function scaleMonsterForLevel<T extends Omit<WorldMonster, "currentHealth" | "id">>(monster: T, level: number, playerCount: number) {
  const floorsAfterFirst = Math.max(0, level - 1);
  const additionalPlayers = Math.max(0, Math.floor(playerCount) - 1);
  const damageScale = (1 + floorsAfterFirst * GAME_PARAMETERS.monsterScaling.damageIncreasePerLevel) *
    (1 + additionalPlayers * GAME_PARAMETERS.monsterScaling.damageIncreasePerAdditionalPlayer);
  const healthScale = (1 + floorsAfterFirst * GAME_PARAMETERS.monsterScaling.healthIncreasePerLevel) *
    (1 + additionalPlayers * GAME_PARAMETERS.monsterScaling.healthIncreasePerAdditionalPlayer);
  return {
    ...monster,
    attack: Math.round((monster.attack ?? monster.damage) * damageScale),
    damage: Math.round(monster.damage * damageScale),
    maximumHealth: Math.round(monster.maximumHealth * healthScale),
  };
}

export function createMonster(index: number, roomId: string, random: () => number, level = 1, playerCount = 1): WorldMonster {
  // Cycle through ordinary monster types while using the seeded stream for unique stable IDs.
  const monsters = POSSIBLE_MONSTERS.filter((monster) => !monster.chases);
  const monster = monsters[index % monsters.length];
  const scaledMonster = scaleMonsterForLevel(monster, level, playerCount);
  return {
    ...scaledMonster,
    currentHealth: scaledMonster.maximumHealth,
    id: `${roomId}:monster:${index}:${Math.floor(random() * 1_000_000)}`,
  };
}

export function createWerewolf(roomId: string, level = 1, playerCount = 1): WorldMonster {
  // The chasing monster has one deterministic identity per room for save/map references.
  const werewolf = POSSIBLE_MONSTERS.find((monster) => monster.chases)!;
  const scaledWerewolf = scaleMonsterForLevel(werewolf, level, playerCount);
  return { ...scaledWerewolf, maximumHealth: 1, currentHealth: 1, id: `${roomId}:werewolf` };
}
