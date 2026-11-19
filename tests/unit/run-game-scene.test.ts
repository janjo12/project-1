import { getRoomSceneActors } from "@/game/engine/run-game-scene";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { getTargetableMonsters } from "@/game/dungeon/rooms";
import { directionScenePositions } from "@/game/state/types";
import { getNeighborRoom, oppositeDirections } from "@/game/dungeon/types";

describe("room scene enemy visibility", () => {
  it("renders every living monster that can attack in each room, including guards registered on the opposite side", () => {
    const map = createSeededDungeonMap("mvpplp0k-2-0wrwzs", 1);

    for (const room of map.rooms.flat()) {
      const targetableIds = getTargetableMonsters(map, room).map(monster => monster.id);
      const renderedIds = getRoomSceneActors({
        currentMonsterId: null,
        dungeonMap: map,
        room,
      }).filter(actor => actor.kind === "enemy").map(actor => actor.id);

      expect(renderedIds).toEqual(expect.arrayContaining(targetableIds));
    }
  });

  it("centers each doorway guard on the guarded edge from both connected rooms", () => {
    const map = createSeededDungeonMap("mvpplp0k-2-0wrwzs", 1);
    const guards = Object.values(map.entities.doorwayGuards);

    expect(guards.length).toBeGreaterThan(0);
    for (const guard of guards) {
      const originRoom = map.rooms.flat().find(candidate => candidate.id === guard.roomId)!;
      const neighborRoom = getNeighborRoom(map.rooms, guard.roomId, guard.direction)!;
      const originActor = getRoomSceneActors({ currentMonsterId: null, dungeonMap: map, room: originRoom })
        .find(candidate => candidate.id === guard.monsterId);
      const neighborActor = getRoomSceneActors({ currentMonsterId: null, dungeonMap: map, room: neighborRoom })
        .find(candidate => candidate.id === guard.monsterId);

      expect(originActor?.position).toBe(directionScenePositions[guard.direction]);
      expect(originActor?.isDoorwayGuard).toBe(true);
      expect(neighborActor?.position).toBe(directionScenePositions[oppositeDirections[guard.direction]]);
      expect(neighborActor?.isDoorwayGuard).toBe(true);
    }
  });
});
