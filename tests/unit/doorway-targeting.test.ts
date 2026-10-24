import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { getRoom, getTargetableMonsters } from "@/game/dungeon/rooms";
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

  it("guards every test-floor entrance to the stairs from the neighboring room", () => {
    const map = createSeededDungeonMap("testwarrior", 1, undefined, true);
    const golems = Object.values(map.entities.monsters).filter(monster => monster.name === "Pixel Golem");

    expect(golems).toHaveLength(4);
    for (const golem of golems) {
      const guard = map.entities.doorwayGuards[golem.id];
      expect(guard).toBeDefined();
      expect(map.rooms.flat().some(room => room.contents.some(content => content.type === "monster" && content.id === golem.id))).toBe(false);
      expect(map.rooms.flat().find(room => room.id === guard!.roomId)?.[guard!.direction]).toBe("guarded");
    }
    const stairsRoom = map.rooms.flat().find(room => room.contents.some(content => content.type === "stairs"))!;
    const stairsDirection = (["north", "east", "south", "west"] as const).find(direction => stairsRoom[direction] === "guarded");
    expect(stairsDirection).toBeDefined();
    const stairsEntryGuard = getDoorwayGuardPlacements(map, stairsRoom.id, stairsDirection!)[0];
    expect(stairsEntryGuard).toBeDefined();
    expect(stairsEntryGuard!.roomId).not.toBe(stairsRoom.id);
    expect(getTargetableMonsters(map, getRoom(map, stairsEntryGuard!.roomId))
      .some(monster => monster.id === stairsEntryGuard!.monsterId)).toBe(true);
  });
});
