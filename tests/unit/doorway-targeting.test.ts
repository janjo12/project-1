import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { getTargetableMonsters } from "@/game/dungeon/rooms";
import { getAttackTarget } from "@/game/engine/targeting";
import { getDoorwayGuardPlacements } from "@/game/dungeon/types";

describe("doorway guard combat targeting", () => {
  it("allows attacks on a doorway guard in an ordinary generated floor", () => {
    const map = createSeededDungeonMap("doorway-attack-regression", 1);
    const guard = Object.values(map.entities.doorwayGuards)[0];
    expect(guard).toBeDefined();

    const room = map.rooms.flat().find(candidate => candidate.id === guard!.roomId)!;
    expect(getDoorwayGuardPlacements(map, room.id, guard!.direction)).toContainEqual(guard);
    expect(getTargetableMonsters(map, room).some(monster => monster.id === guard!.monsterId)).toBe(true);
    expect(getAttackTarget(map, room.id, guard!.monsterId)?.id).toBe(guard!.monsterId);
  });

  it("puts the test-floor golems on doorway boundaries like a normal floor", () => {
    const map = createSeededDungeonMap("testwarrior", 1, undefined, true);
    const golems = Object.values(map.entities.monsters).filter(monster => monster.name === "Pixel Golem");

    expect(golems).toHaveLength(3);
    for (const golem of golems) {
      const guard = map.entities.doorwayGuards[golem.id];
      expect(guard).toBeDefined();
      expect(map.rooms.flat().some(room => room.contents.some(content => content.type === "monster" && content.id === golem.id))).toBe(false);
      expect(map.rooms.flat().find(room => room.id === guard!.roomId)?.[guard!.direction]).toBe("guarded");
    }
  });
});
