import type { RoomDoorways, ScenePosition } from "@/components/game-view-panel";
import { PLAYER } from "@/entities";
import type { Direction } from "@/utils/dungeon-map";
import type { Difficulty } from "@/utils/settings-storage";

export const PLAYER_MAX_HEALTH = PLAYER.maxHealth;
export const PLAYER_MAX_ENERGY = PLAYER.maxEnergy;

export const directionScenePositions = {
  east: "right",
  north: "top",
  south: "bottom",
  west: "left",
} satisfies Record<Direction, ScenePosition>;

export const defaultRoomDoorways: RoomDoorways = {
  bottom: "wall",
  left: "wall",
  right: "wall",
  top: "wall",
};

export const playerEntryPositions = {
  east: "left",
  north: "bottom",
  south: "top",
  west: "right",
} satisfies Record<Direction, ScenePosition>;

export type UseGameRunOptions = {
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
  seed: string;
  vibrationEnabled: boolean;
};
