import type { RoomDoorways, RoomSceneActor, ScenePosition } from "@/components/Dungeon/GameViewPanel";
import { getDoorwayGuardPlacements, type DungeonMap, type WorldMonster } from "@/game/dungeon/types";
import {
  getCurrentRoom, getTargetableRoomMonsterRefs,
} from "@/game/dungeon/rooms";
import { defaultRoomDoorways, directionScenePositions } from "@/game/state/types";
import { getEquipmentGroundLabel } from "@/game/actions/items";

export function getRoomDoorways(room: ReturnType<typeof getCurrentRoom>): RoomDoorways {
  // Convert world compass directions into the scene component's top/right/bottom/left keys.
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
  // Build a render-only actor list while de-duplicating monsters referenced both in rooms and at guarded doors.
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
      const isChest = content.isChest ?? false;
      sceneActors.push({ id: item.id, sprite: isChest ? "chest_closed_graphic" : item.sprite ?? item.label, contentSprite: item.sprite ?? item.label, isChest, kind: "item", label: isChest ? `Chest containing ${item.label}` : item.label, position: "center" });
    } else if (content.type === "equipment") {
      const item = dungeonMap.entities.equipment[content.id];
      if (item) {
        const isChest = content.isChest ?? false;
        const label = getEquipmentGroundLabel(item.equipmentId);
        sceneActors.push({ id: item.id, sprite: isChest ? "chest_closed_graphic" : item.sprite, contentSprite: item.sprite, isChest, kind: "equipment", label: isChest ? `Chest containing ${label}` : label, position: "center" });
      }
    } else if (content.type === "stairs") {
      sceneActors.push({ id: "stairs", sprite: "stairs_graphic", kind: "stairs", label: "Stairs", position: "center" });
    }
  }

  for (const direction of ["north", "east", "south", "west"] as const) {
    // Combat includes guards registered from either side of a doorway; render that same set
    // so every monster that can attack from this room has a visible, clickable actor.
    for (const guard of getDoorwayGuardPlacements(dungeonMap, room.id, direction)) {
      const monster = dungeonMap.entities.monsters[guard.monsterId];
      if (!monster || monster.currentHealth <= 0 || seenMonsterIds.has(monster.id)) continue;
      seenMonsterIds.add(monster.id);
      sceneActors.push(createMonsterSceneActor(monster, monster.id === currentMonsterId, directionScenePositions[direction]));
    }
  }

  return sceneActors.sort((left, right) => Number(Boolean(left.isActive)) - Number(Boolean(right.isActive)));
}
