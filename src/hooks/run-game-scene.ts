import type { RoomDoorways, RoomSceneActor, ScenePosition } from "@/components/game-view-panel";
import { getDoorwayGuardPlacements, type DungeonMap, type WorldMonster } from "@/utils/dungeon-map";
import {
  getCurrentRoom, getGuardedDirections, getTargetableRoomMonsterRefs,
} from "@/utils/dungeon-map-runtime";
import { defaultRoomDoorways, directionScenePositions } from "@/hooks/run-game-types";
import { getEquipmentGroundLabel } from "@/hooks/run-game-items";

export function getRoomDoorways(room: ReturnType<typeof getCurrentRoom>): RoomDoorways {
  if (!room) return defaultRoomDoorways;
  return { bottom: room.south, left: room.west, right: room.east, top: room.north };
}

function createMonsterSceneActor(monster: WorldMonster, isActive: boolean, position: ScenePosition): RoomSceneActor {
  return {
    id: monster.id, currentHealth: monster.currentHealth, sprite: monster.sprite,
    kind: "enemy", isActive, label: monster.name, maxHealth: monster.maximumHealth, position,
  };
}

export function getRoomSceneActors({
  currentMonsterId, dungeonMap, room,
}: {
  currentMonsterId: string | null; dungeonMap: DungeonMap; room: ReturnType<typeof getCurrentRoom>;
}) {
  if (!room) return [];
  const seenMonsterIds = new Set<string>();
  const seenItemIds = new Set<string>();
  const sceneActors: RoomSceneActor[] = [];

  for (const reference of getTargetableRoomMonsterRefs(dungeonMap, room)) {
    const monster = dungeonMap.entities.monsters[reference.id];
    if (!monster || seenMonsterIds.has(monster.id)) continue;
    seenMonsterIds.add(monster.id);
    sceneActors.push(createMonsterSceneActor(monster, monster.id === currentMonsterId, "center"));
  }

  for (const content of room.contents) {
    if (content.type === "item") {
      const item = dungeonMap.entities.items[content.id];
      if (!item || seenItemIds.has(item.id)) continue;
      seenItemIds.add(item.id);
      sceneActors.push({ id: item.id, sprite: item.sprite ?? item.label, kind: "item", label: item.label, position: "center" });
    } else if (content.type === "equipment") {
      const item = dungeonMap.entities.equipment[content.id];
      if (item) sceneActors.push({ id: item.id, sprite: item.sprite, kind: "equipment", label: getEquipmentGroundLabel(item.equipmentId), position: "center" });
    } else if (content.type === "stairs") {
      sceneActors.push({ id: "stairs", sprite: "🪜", kind: "stairs", label: "Stairs", position: "center" });
    }
  }

  for (const direction of getGuardedDirections(dungeonMap, room.id)) {
    for (const guard of getDoorwayGuardPlacements(dungeonMap, room.id, direction)) {
      const monster = guard ? dungeonMap.entities.monsters[guard.monsterId] : null;
      if (!monster || monster.currentHealth <= 0 || seenMonsterIds.has(monster.id)) continue;
      seenMonsterIds.add(monster.id);
      sceneActors.push(createMonsterSceneActor(monster, monster.id === currentMonsterId, directionScenePositions[direction]));
    }
  }

  return sceneActors.sort((left, right) => Number(Boolean(left.isActive)) - Number(Boolean(right.isActive)));
}
