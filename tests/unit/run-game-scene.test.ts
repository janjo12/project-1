import { getRoomSceneActors } from "@/game/engine/run-game-scene";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { getTargetableMonsters } from "@/game/dungeon/rooms";

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
});
