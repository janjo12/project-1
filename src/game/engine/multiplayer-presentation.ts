import type { RoomSceneActor } from "@/components/Dungeon/GameViewPanel";
import { getGameClass, type GameClassId } from "@/game/config/game-classes";

/** Assigns a stable, distinct hue by roster order so identical class sprites remain recognizable. */
export function getMultiplayerPlayerAuraColor(playerIds: readonly string[], playerId: string) {
  const playerIndex = Math.max(0, playerIds.indexOf(playerId));
  const hue = (42 + playerIndex * 137.508) % 360;
  const saturation = 0.82;
  const lightness = 0.58;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = hue / 60;
  const secondComponent = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const [red, green, blue] = hueSection < 1
    ? [chroma, secondComponent, 0]
    : hueSection < 2
      ? [secondComponent, chroma, 0]
      : hueSection < 3
        ? [0, chroma, secondComponent]
        : hueSection < 4
          ? [0, secondComponent, chroma]
          : hueSection < 5
            ? [secondComponent, 0, chroma]
            : [chroma, 0, secondComponent];
  const lightnessOffset = lightness - chroma / 2;
  return `#${[red, green, blue]
    .map(channel => Math.round((channel + lightnessOffset) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

type RoomPlayer = { id: string; roomId: string; classId: GameClassId };

export function getMultiplayerRoomActors(
  actors: RoomSceneActor[],
  players: readonly RoomPlayer[],
  roomId: string,
  localPlayerId: string,
) {
  const playerIds = players.map(player => player.id);
  const allies = players
    .filter(player => player.id !== localPlayerId && player.roomId === roomId)
    .map(player => {
      const gameClass = getGameClass(player.classId);
      return {
        id: player.id,
        kind: "player" as const,
        sprite: gameClass.sprite,
        label: `${gameClass.name} · ${player.id}`,
        position: "center" as const,
        auraColor: getMultiplayerPlayerAuraColor(playerIds, player.id),
      };
    });
  return [...actors, ...allies];
}
