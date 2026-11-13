export type Difficulty = "easy" | "normal" | "hard";
export type Appearance = "system" | "light" | "dark";
export type Handedness = "left" | "right";

export type GameSettings = {
  appearance: Appearance;
  difficulty: Difficulty;
  seed: string;
  microgamesEnabled: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
  handedness: Handedness;
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  appearance: "system",
  difficulty: "easy",
  seed: "",
  microgamesEnabled: true,
  vibrationEnabled: true,
  reducedMotion: false,
  handedness: "right",
};

export function normalizeSettings(value: unknown): GameSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_GAME_SETTINGS };
  const candidate = value as Partial<GameSettings>;
  return {
    appearance: candidate.appearance === "system" || candidate.appearance === "light" || candidate.appearance === "dark" ? candidate.appearance : DEFAULT_GAME_SETTINGS.appearance,
    difficulty: candidate.difficulty === "easy" || candidate.difficulty === "normal" || candidate.difficulty === "hard" ? candidate.difficulty : DEFAULT_GAME_SETTINGS.difficulty,
    seed: typeof candidate.seed === "string" ? candidate.seed : DEFAULT_GAME_SETTINGS.seed,
    microgamesEnabled: typeof candidate.microgamesEnabled === "boolean" ? candidate.microgamesEnabled : DEFAULT_GAME_SETTINGS.microgamesEnabled,
    vibrationEnabled: typeof candidate.vibrationEnabled === "boolean" ? candidate.vibrationEnabled : DEFAULT_GAME_SETTINGS.vibrationEnabled,
    reducedMotion: typeof candidate.reducedMotion === "boolean" ? candidate.reducedMotion : DEFAULT_GAME_SETTINGS.reducedMotion,
    handedness: candidate.handedness === "left" || candidate.handedness === "right" ? candidate.handedness : DEFAULT_GAME_SETTINGS.handedness,
  };
}
