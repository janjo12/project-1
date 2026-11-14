import type { Difficulty } from "@/utils/game-settings";

export type MultiplayerPlayerOptions = {
  difficulty: Difficulty;
  handedness: "left" | "right";
  microgamesEnabled: boolean;
  reducedMotion: boolean;
};

export const DEFAULT_MULTIPLAYER_PLAYER_OPTIONS: MultiplayerPlayerOptions = {
  difficulty: "easy",
  handedness: "right",
  microgamesEnabled: true,
  reducedMotion: false,
};

export function isMultiplayerPlayerOptions(value: unknown): value is MultiplayerPlayerOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const options = value as Record<string, unknown>;
  return (options.difficulty === "easy" || options.difficulty === "normal" || options.difficulty === "hard") &&
    (options.handedness === "left" || options.handedness === "right") &&
    typeof options.microgamesEnabled === "boolean" &&
    typeof options.reducedMotion === "boolean";
}

export function isMultiplayerPlayerOptionsPatch(value: unknown): value is Partial<MultiplayerPlayerOptions> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const options = value as Record<string, unknown>;
  return (options.difficulty === undefined || options.difficulty === "easy" || options.difficulty === "normal" || options.difficulty === "hard") &&
    (options.handedness === undefined || options.handedness === "left" || options.handedness === "right") &&
    (options.microgamesEnabled === undefined || typeof options.microgamesEnabled === "boolean") &&
    (options.reducedMotion === undefined || typeof options.reducedMotion === "boolean");
}

export function updateMultiplayerPlayerOptions(current: MultiplayerPlayerOptions, patch: Partial<MultiplayerPlayerOptions>): MultiplayerPlayerOptions {
  return { ...current, ...patch };
}

export function multiplayerPlayerOptionsPatch(value: Record<string, unknown>): Partial<MultiplayerPlayerOptions> {
  return {
    ...(value.difficulty === undefined ? {} : { difficulty: value.difficulty as Difficulty }),
    ...(value.handedness === undefined ? {} : { handedness: value.handedness as "left" | "right" }),
    ...(value.microgamesEnabled === undefined ? {} : { microgamesEnabled: value.microgamesEnabled as boolean }),
    ...(value.reducedMotion === undefined ? {} : { reducedMotion: value.reducedMotion as boolean }),
  };
}
