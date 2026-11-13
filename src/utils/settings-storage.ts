import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_GAME_SETTINGS, normalizeSettings } from "@/utils/game-settings";
import type { GameSettings } from "@/utils/game-settings";
export { DEFAULT_GAME_SETTINGS, normalizeSettings } from "@/utils/game-settings";
export type { Appearance, Difficulty, GameSettings, Handedness } from "@/utils/game-settings";

const SETTINGS_STORAGE_KEY = "project-1:game-settings";

function getBrowserStorage(): Storage | null {
  return typeof globalThis.window?.localStorage === "undefined"
    ? null
    : globalThis.window.localStorage;
}

export async function loadGameSettings(): Promise<GameSettings> {
  try {
    const browserStorage = getBrowserStorage();
    const storedSettings = browserStorage
      ? browserStorage.getItem(SETTINGS_STORAGE_KEY)
      : await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      await saveGameSettings(DEFAULT_GAME_SETTINGS);
      return DEFAULT_GAME_SETTINGS;
    }

    return normalizeSettings(JSON.parse(storedSettings));
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export async function saveGameSettings(settings: GameSettings) {
  const serialized = JSON.stringify(normalizeSettings(settings));
  const browserStorage = getBrowserStorage();
  if (browserStorage) {
    browserStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
  } else {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
  }
}
