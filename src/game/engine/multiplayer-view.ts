import { moveCurrentPosition } from "@/game/dungeon/rooms";
import { getRunSnapshot } from "@/game/engine/run-game-snapshot";
import type { MultiplayerState } from "@/game/engine/multiplayer-rules";

/** Builds the same player-specific scene and controls for every multiplayer transport. */
export function getMultiplayerPlayerView(state: MultiplayerState | null, playerId: string) {
  const player = state?.players[playerId];
  const currentMap = state && player ? moveCurrentPosition(state.map, player.roomId) : null;
  const snapshot = state && player && currentMap ? getRunSnapshot({
    activeMonsterId: null,
    clearedLevels: state.level - 1,
    difficulty: state.difficulty,
    dungeonMap: currentMap,
    inventoryItem: player.item,
    equipment: player.equipment ?? null,
    isResolving: false,
    level: state.level,
    playerEnergy: player.energy,
    playerHealth: player.health,
    turnCounter: state.turnsLeft,
  }) : null;

  return {
    player,
    map: snapshot?.visibleDungeonMap ?? currentMap,
    snapshot,
  };
}
