import { gameClassForSeed, getGameClass } from "@/game/config/game-classes";

describe("customized test seeds", () => {
  it("uses the Warrior for the exact end-to-end test seed", () => {
    expect(gameClassForSeed("test").id).toBe("warrior");
  });
  test.each([
    ["testwarrior", "warrior"],
    ["testthief", "thief"],
    ["testcleric", "cleric"],
    ["testarcher", "archer"],
    ["testranger", "archer"],
    ["testwizard", "wizard"],
  ])("seed %s selects %s", (seed, expectedClass) => {
    expect(gameClassForSeed(seed).id).toBe(expectedClass);
  });

  it("chooses ordinary run classes randomly, independently of the dungeon seed", () => {
    expect(gameClassForSeed("replayable-seed", () => 0).id).toBe("warrior");
    expect(gameClassForSeed("replayable-seed", () => 0.99).id).toBe("wizard");
  });

  it("does not assign the multiplayer-only ghost class from a singleplayer seed", () => {
    expect(gameClassForSeed("testghost", () => 0).id).toBe("warrior");
  });
});

test("Wizard has Chain Lightning, Empower Attacks, and Rune Tracer instructions", () => {
  const wizard = getGameClass("wizard");
  expect(wizard.sprite).toBe("wizard_graphic");
  expect(wizard.special).toContain("Chain Lightning");
  expect(wizard.support.singleplayer).toContain("Empower Attacks");
  expect(wizard.support.multiplayer).toContain("next 2 turns");
  expect(wizard.microgame).toBe("rune-tracer");
  expect(getGameClass("archer").name).toBe("Ranger");
});
