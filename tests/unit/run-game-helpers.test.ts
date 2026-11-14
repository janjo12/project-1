import { restartAnimationFrame, swapRoomItemWithInventory } from "@/game/engine/run-game-helpers";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { getRoom } from "@/game/dungeon/rooms";
import { createCombatAnimationFrame } from "@/game/entities";

test("restartAnimationFrame resets only requested channels without changing the source frame", () => {
  const original = { ...createCombatAnimationFrame(), enemyAttackElapsed: 0.7, enemyDamageElapsed: 0.4, playerAttackElapsed: 0.8, playerDamageElapsed: 0.5 };
  const next = restartAnimationFrame(original, ["enemyAttackElapsed", "playerDamageElapsed"]);
  expect(next).toEqual({ ...original, enemyAttackElapsed: 0, playerDamageElapsed: 0 });
  expect(original.enemyAttackElapsed).toBe(0.7);
});

test("swapRoomItemWithInventory drops the old item into the same room and leaves inputs unchanged", () => {
  const map = createSeededDungeonMap("item-swap-unit", 1);
  const roomId = map.startingRoomId;
  const room = getRoom(map, roomId);
  room.contents = [{ type: "item", id: "new-potion" }];
  map.entities.items["new-potion"] = { id: "new-potion", itemId: "health-potion", label: "Potion", type: "item" };
  const next = swapRoomItemWithInventory({ currentRoomId: roomId, currentRoomItemId: "health-potion", dungeonMap: map, inventoryItem: "key" });
  expect(getRoom(next, roomId).contents).toHaveLength(2);
  expect(getRoom(next, roomId).contents.some(content => content.type === "item" && content.id === "new-potion")).toBe(true);
  expect(getRoom(next, roomId).contents.some(content => content.type === "item" && next.entities.items[content.id]?.itemId === "key")).toBe(true);
  expect(map.entities.items["new-potion"]).toBeDefined();
  expect(map.entities.items.key).toBeUndefined();
});
