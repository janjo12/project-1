import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  saveGameSettings,
} from "@/utils/settings-storage";

describe("settings storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("creates default settings when storage is empty", async () => {
    await expect(loadGameSettings()).resolves.toEqual(DEFAULT_GAME_SETTINGS);

    await expect(AsyncStorage.getItem("project-1:game-settings")).resolves.toBe(
      JSON.stringify(DEFAULT_GAME_SETTINGS),
    );
  });

  it("loads saved settings", async () => {
    await saveGameSettings({
      appearance: "dark",
      difficulty: "hard",
      handedness: "left",
      seed: "abc123",
      vibrationEnabled: false,
    });

    await expect(loadGameSettings()).resolves.toEqual({
      appearance: "dark",
      difficulty: "hard",
      handedness: "left",
      seed: "abc123",
      vibrationEnabled: false,
    });
  });

  it("normalizes invalid saved settings", async () => {
    await AsyncStorage.setItem(
      "project-1:game-settings",
      JSON.stringify({
        appearance: "moonlight",
        difficulty: "impossible",
        handedness: "middle",
        seed: 42,
        vibrationEnabled: "sometimes",
      }),
    );

    await expect(loadGameSettings()).resolves.toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("falls back to defaults when saved JSON is invalid", async () => {
    await AsyncStorage.setItem("project-1:game-settings", "{not-json");

    await expect(loadGameSettings()).resolves.toEqual(DEFAULT_GAME_SETTINGS);
  });
});
