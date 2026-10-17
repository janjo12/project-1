import type { DungeonMap, WorldMonster } from "@/game/dungeon/types";
import { getRoom, getTargetableMonsters } from "@/game/dungeon/rooms";

/** Returns a living monster only when the room rules allow the player to target it. */
export function getAttackTarget(map: DungeonMap, roomId: string, monsterId: string): WorldMonster | null {
  return getTargetableMonsters(map, getRoom(map, roomId))
    .find((monster) => monster.id === monsterId) ?? null;
}
