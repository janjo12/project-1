import AsyncStorage from "@react-native-async-storage/async-storage";

export type Difficulty = "easy" | "normal" | "hard";
export type Handedness = "left" | "right";

export type GameSettings = {
  difficulty: Difficulty;
  handedness: Handedness;
  seed: string;
};

const SETTINGS_STORAGE_KEY = "project-1:game-settings";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  difficulty: "normal",
  handedness: "right",
  seed: "",
};

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

function isHandedness(value: unknown): value is Handedness {
  return value === "left" || value === "right";
}

function normalizeSettings(value: unknown): GameSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_GAME_SETTINGS;
  }

  const candidate = value as Partial<GameSettings>;

  return {
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
