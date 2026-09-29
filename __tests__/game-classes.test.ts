import { gameClassForSeed } from "@/game/config/game-classes";

describe("customized test seeds", () => {
  test.each([
    ["testwarrior", "warrior"],
    ["testthief", "thief"],
    ["testcleric", "cleric"],
  ])("seed %s selects %s", (seed, expectedClass) => {
    expect(gameClassForSeed(seed).id).toBe(expectedClass);
  });
});
