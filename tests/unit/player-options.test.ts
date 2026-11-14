import {
  DEFAULT_MULTIPLAYER_PLAYER_OPTIONS,
  isMultiplayerPlayerOptions,
  isMultiplayerPlayerOptionsPatch,
  multiplayerPlayerOptionsPatch,
  updateMultiplayerPlayerOptions,
} from "@/multiplayer/player-options";

describe("multiplayer player options", () => {
  it("provides independent defaults for each player", () => {
    expect(DEFAULT_MULTIPLAYER_PLAYER_OPTIONS).toEqual({
      difficulty: "easy",
      handedness: "right",
      microgamesEnabled: true,
      reducedMotion: false,
    });
    expect(updateMultiplayerPlayerOptions(DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, { difficulty: "hard" }))
      .toEqual({ ...DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, difficulty: "hard" });
    expect(DEFAULT_MULTIPLAYER_PLAYER_OPTIONS.difficulty).toBe("easy");
  });

  it.each([
    ["easy", "right", true, false],
    ["normal", "left", false, true],
    ["hard", "right", false, false],
  ] as const)("accepts valid full option set %s/%s", (difficulty, handedness, microgamesEnabled, reducedMotion) => {
    expect(isMultiplayerPlayerOptions({ difficulty, handedness, microgamesEnabled, reducedMotion })).toBe(true);
  });

  it.each([
    null,
    undefined,
    [],
    "easy",
    1,
    {},
    { ...DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, difficulty: "nightmare" },
    { ...DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, handedness: "up" },
    { ...DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, microgamesEnabled: "yes" },
    { ...DEFAULT_MULTIPLAYER_PLAYER_OPTIONS, reducedMotion: 0 },
  ])("rejects invalid or incomplete full option value %#", value => {
    expect(isMultiplayerPlayerOptions(value)).toBe(false);
  });

  it("accepts empty and partial patches while rejecting invalid supplied fields", () => {
    expect(isMultiplayerPlayerOptionsPatch({})).toBe(true);
    expect(isMultiplayerPlayerOptionsPatch({ difficulty: "hard", reducedMotion: true })).toBe(true);
    expect(isMultiplayerPlayerOptionsPatch({ handedness: undefined, microgamesEnabled: undefined })).toBe(true);
    for (const patch of [null, [], "left", { difficulty: null }, { handedness: "center" },
      { microgamesEnabled: 1 }, { reducedMotion: "false" }]) {
      expect(isMultiplayerPlayerOptionsPatch(patch)).toBe(false);
    }
  });

  it("converts validated records into patches without inventing unset options", () => {
    expect(multiplayerPlayerOptionsPatch({ difficulty: "normal", reducedMotion: true, ignored: "value" }))
      .toEqual({ difficulty: "normal", reducedMotion: true });
    expect(multiplayerPlayerOptionsPatch({})).toEqual({});
    expect(multiplayerPlayerOptionsPatch({ handedness: undefined })).toEqual({});
  });

  it("applies only the supplied options and leaves the input unchanged", () => {
    const current = { ...DEFAULT_MULTIPLAYER_PLAYER_OPTIONS };
    const updated = updateMultiplayerPlayerOptions(current, { handedness: "left", microgamesEnabled: false });
    expect(updated).toEqual({ ...current, handedness: "left", microgamesEnabled: false });
    expect(updated).not.toBe(current);
    expect(current).toEqual(DEFAULT_MULTIPLAYER_PLAYER_OPTIONS);
  });
});
