import { getWerewolfEntryPosition } from "@/game/engine/werewolf-transition";

describe("werewolf room-entry direction", () => {
  test.each([
    ["A1", "A2", "left"],
    ["A2", "A1", "right"],
    ["A1", "B1", "top"],
    ["B1", "A1", "bottom"],
    ["A1", "D5", "left"],
  ] as const)("enters from the correct side moving from %s to %s", (from, to, expected) => {
    expect(getWerewolfEntryPosition(from, to)).toBe(expected);
  });
});
