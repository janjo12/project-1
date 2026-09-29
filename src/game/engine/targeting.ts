import type { DungeonMap, WorldMonster } from "@/game/dungeon/types";
import { getRoom, getTargetableRoomMonsterRefs } from "@/game/dungeon/rooms";

/** Returns a living monster only when the room rules allow the player to target it. */
export function getAttackTarget(map: DungeonMap, roomId: string, monsterId: string): WorldMonster | null {
  const targetable = getTargetableRoomMonsterRefs(map, getRoom(map, roomId))
    .some((reference) => reference.id === monsterId);
  const monster = map.entities.monsters[monsterId];
  return targetable && monster && monster.currentHealth > 0 ? monster : null;
}
