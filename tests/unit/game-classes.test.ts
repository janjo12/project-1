import { gameClassForSeed } from "@/game/config/game-classes";

describe("customized test seeds", () => {
  it("uses the Warrior for the exact end-to-end test seed", () => {
    expect(gameClassForSeed("test").id).toBe("warrior");
  });
  test.each([
    ["testwarrior", "warrior"],
    ["testthief", "thief"],
    ["testcleric", "cleric"],
  ])("seed %s selects %s", (seed, expectedClass) => {
    expect(gameClassForSeed(seed).id).toBe(expectedClass);
  });

  it("chooses ordinary run classes randomly, independently of the dungeon seed", () => {
    const random = jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    expect(gameClassForSeed("replayable-seed").id).toBe("warrior");
    expect(gameClassForSeed("replayable-seed").id).toBe("thief");
    expect(random).toHaveBeenCalledTimes(2);
    random.mockRestore();
  });
});
