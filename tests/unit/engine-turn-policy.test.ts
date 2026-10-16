import { getHardTurnLimit, getTurnDuration, hasTurnLimit, hasTurnTimer, resolveTurnLoss } from "@/game/engine/resolveTurn";
import { createEmptyGrid } from "@/game/dungeon/types";
import type { DungeonMap } from "@/game/dungeon/types";

const map = (): DungeonMap => ({ columns: ["A"], rows: [1, 2], level: 1, startingRoomId: "A1", rooms: [[
  { ...createEmptyGrid()[0][0], id: "A1", column: "A", row: 1, isCurrentPosition: true, isRevealed: true, east: "open" },
  { ...createEmptyGrid()[0][1], id: "A2", column: "A", row: 2, isRevealed: true, west: "open" },
]], entities: { items: {}, equipment: {}, monsters: {}, doorwayGuards: {} } });

describe("documented run clock policy", () => {
  it("limits Normal and Hard turns, and exposes a countdown only in Hard", () => {
    expect([hasTurnLimit("easy"), hasTurnLimit("normal"), hasTurnLimit("hard")]).toEqual([false, true, true]);
    expect([hasTurnTimer("easy"), hasTurnTimer("normal"), hasTurnTimer("hard")]).toEqual([false, false, true]);
  });
  it("uses four turns per active room and shrinks duration by 30ms per level", () => {
    expect(getHardTurnLimit({ difficulty: "normal", map: map() })).toBe(8);
    expect(getTurnDuration({ difficulty: "hard", level: 2 })).toBe(4970);
  });
  it("consumes a Clock at zero and grants five plus the current level", () => {
    expect(resolveTurnLoss(1, "clock", 4)).toEqual({ nextCounter: 9, usesClock: true });
    expect(resolveTurnLoss(1, null, 4)).toEqual({ nextCounter: 0, usesClock: false });
    expect(resolveTurnLoss(0, "clock", 4)).toEqual({ nextCounter: 0, usesClock: false });
  });
});
