import AsyncStorage from "@react-native-async-storage/async-storage";

export type Difficulty = "easy" | "normal" | "hard";
export type Handedness = "left" | "right";
export type Appearance = "system" | "light" | "dark";

export type GameSettings = {
  appearance: Appearance;
  difficulty: Difficulty;
  handedness: Handedness;
  seed: string;
  vibrationEnabled: boolean;
};

const SETTINGS_STORAGE_KEY = "project-1:game-settings";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  appearance: "system",
  difficulty: "normal",
  handedness: "right",
  seed: "",
  vibrationEnabled: true,
};

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

function isHandedness(value: unknown): value is Handedness {
  return value === "left" || value === "right";
}

function isAppearance(value: unknown): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

function normalizeSettings(value: unknown): GameSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_GAME_SETTINGS;
  }

  const candidate = value as Partial<GameSettings>;

  return {
    appearance: isAppearance(candidate.appearance)
      ? candidate.appearance
      : DEFAULT_GAME_SETTINGS.appearance,
    difficulty: isDifficulty(candidate.difficulty)
      ? candidate.difficulty
      : DEFAULT_GAME_SETTINGS.difficulty,
    handedness: isHandedness(candidate.handedness)
      ? candidate.handedness
      : DEFAULT_GAME_SETTINGS.handedness,
    seed:
      typeof candidate.seed === "string"
        ? candidate.seed
        : DEFAULT_GAME_SETTINGS.seed,
    vibrationEnabled:
      typeof candidate.vibrationEnabled === "boolean"
        ? candidate.vibrationEnabled
        : DEFAULT_GAME_SETTINGS.vibrationEnabled,
  };
}

export async function loadGameSettings(): Promise<GameSettings> {
  try {
    const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

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
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeSettings(settings)),
  );
}
