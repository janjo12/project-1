import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { PixelSprite } from "@/components/Common/PixelSprite";
import { useThemeColors, type ThemeColors } from "@/components/Common/theme";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { getRoomMonster, getRoomPosition, getRooms } from "@/game/dungeon/rooms";
import type { DungeonMap as DungeonMapType } from "@/game/dungeon/types";

type DungeonMapProps = {
  currentRoomId: string;
  map: DungeonMapType;
  compact?: boolean;
  players?: { id: string; roomId: string; color: string }[];
};

export function DungeonMap({
  currentRoomId,
  map,
  players = [],
  compact: forceCompact = false,
}: DungeonMapProps) {
  const colors = useThemeColors();
  const { height } = useWindowDimensions();
  const compact = forceCompact || height < 800;
  const veryCompact = height < 500;
  const styles = createStyles(colors, compact, veryCompact);
  const roomMap = new Map(getRooms(map).map((room) => [room.id, room]));
  const currentRoomPosition = getRoomPosition(currentRoomId);
  const adjacentRoomId = (roomId: string, direction: "north" | "east" | "south" | "west") => {
    const row = roomId[0];
    const column = Number(roomId.slice(1));
    const rowIndex = map.columns.indexOf(row);
    if (direction === "north") return map.columns[rowIndex - 1] ? `${map.columns[rowIndex - 1]}${column}` : null;
    if (direction === "south") return map.columns[rowIndex + 1] ? `${map.columns[rowIndex + 1]}${column}` : null;
    if (direction === "east") return map.rows.includes(column + 1) ? `${row}${column + 1}` : null;
    return map.rows.includes(column - 1) ? `${row}${column - 1}` : null;
  };
  const hasRevealedConnection = (room: ReturnType<typeof getRooms>[number], direction: "north" | "east" | "south" | "west") => {
    const neighborId = adjacentRoomId(room.id, direction);
    // Only open doorways show hallway segments. Locked and guarded doorways use
    // their lock/guard marker until they are unlocked or cleared.
    return Boolean(neighborId && room.isRevealed && room[direction] === "open");
  };
  if (!roomMap.has(currentRoomId)) {
    throw new Error(`Current room ${currentRoomId} is missing from the dungeon map`);
  }

  return (
    <View
      style={[styles.wrapper, compact && styles.compactWrapper]}
      testID="dungeon-map"
    >
      <Text style={styles.title}>Level {map.level} Map</Text>
      {!veryCompact ? <View style={styles.columnHeaderRow}>
        <View style={styles.cornerLabel} />
        {map.rows.map((columnNumber) => {
          const isCurrentColumn = columnNumber === currentRoomPosition.row;

          return (
            <Text
              key={columnNumber}
              style={[
                styles.columnLabel,
                isCurrentColumn && styles.currentAxisLabel,
              ]}
              testID={`map-column-label-${columnNumber}`}
            >
              {columnNumber}
            </Text>
          );
        })}
      </View> : null}

      <View style={[styles.body, { aspectRatio: GAME_PARAMETERS.dungeon.mapWidthRooms / GAME_PARAMETERS.dungeon.mapHeightRooms }]}>
        <View style={styles.rowLabels}>
          {map.columns.map((rowLetter) => {
            const isCurrentRow = rowLetter === currentRoomPosition.column;

            return (
              <Text
                key={rowLetter}
                style={[
                  styles.rowLabel,
                  isCurrentRow && styles.currentAxisLabel,
                ]}
                testID={`map-row-label-${rowLetter}`}
              >
                {rowLetter}
              </Text>
            );
          })}
        </View>
        <View style={styles.grid}>
          {map.columns.map((rowLetter) => (
            <View key={rowLetter} style={styles.gridRow}>
              {map.rows.map((columnNumber) => {
                const roomId = `${rowLetter}${columnNumber}`;
                const room = roomMap.get(roomId);
                if (!room) throw new Error(`Dungeon grid cell ${roomId} is missing from the map`);
                const isCurrentRoom = room.id === currentRoomId;
                const isRevealed = room.isRevealed;
                const hasNorthLock = room.north === "locked";
                const hasEastLock = room.east === "locked";
                const hasSouthLock = room.south === "locked";
                const hasWestLock = room.west === "locked";
                const hasNorthGuard = room.north === "guarded";
                const hasEastGuard = room.east === "guarded";
                const hasSouthGuard = room.south === "guarded";
                const hasWestGuard = room.west === "guarded";
                const hasStairs = room.contents.some(
                  (content) => content.type === "stairs",
                );
                const hasWerewolf = Boolean(getRoomMonster(map, room)?.chases);
                const hasMonster = Boolean(getRoomMonster(map, room));
                const hasItem = room.contents.some(content => content.type === "item");
                const hasEquipment = room.contents.some(content => content.type === "equipment");
                const roomPlayers = players.filter(player => player.roomId === roomId);
                const roomColor = isCurrentRoom
                  ? colors.mapCurrentRoom
                  : hasStairs
                    ? colors.mapStairsRoom
                    : hasMonster
                      ? colors.mapEnemyRoom
                      : hasItem || hasEquipment
                        ? colors.mapItemRoom
                        : colors.mapExploredRoom;

                return (
                  <View key={columnNumber} style={styles.gridCell} testID={`map-cell-${roomId}`}>
                    {hasRevealedConnection(room, "north") ? <View testID={`map-corridor-${roomId}-north`} style={[styles.corridor, styles.northCorridor]} /> : null}
                    {hasRevealedConnection(room, "east") ? <View testID={`map-corridor-${roomId}-east`} style={[styles.corridor, styles.eastCorridor]} /> : null}
                    {hasRevealedConnection(room, "south") ? <View testID={`map-corridor-${roomId}-south`} style={[styles.corridor, styles.southCorridor]} /> : null}
                    {hasRevealedConnection(room, "west") ? <View testID={`map-corridor-${roomId}-west`} style={[styles.corridor, styles.westCorridor]} /> : null}
                    {room && isRevealed ? (
                      <View
                        accessibilityLabel={`Room ${rowLetter}${columnNumber}${isCurrentRoom ? ", your room" : ""}${hasMonster ? ", monster" : ""}${hasItem ? ", item" : ""}${hasEquipment ? ", equipment" : ""}${hasStairs ? ", stairs" : ""}`}
                        style={[styles.room, { backgroundColor: roomColor }, isCurrentRoom && styles.currentRoom]}
                        testID={isCurrentRoom ? "current-dungeon-room" : `map-room-${rowLetter}${columnNumber}`}
                      >
                        {roomPlayers.length ? (
                          <View
                            accessibilityLabel={roomPlayers.map(player => `${player.id} position`).join(", ")}
                            style={styles.playerMarkers}
                          >
                            {roomPlayers.map(player => (
                              <View
                                key={player.id}
                                accessibilityLabel={`${player.id} position`}
                                style={[styles.playerMarker, { backgroundColor: player.color }]}
                                testID={`map-player-${player.id}-${roomId}`}
                              />
                            ))}
                          </View>
                        ) : null}
                        {hasNorthLock ? (
                          <Text testID={`map-locked-doorway-${roomId}-top`} accessible={false} style={[styles.iconOverlay, styles.lockIcon, styles.northLock]}>🔒</Text>
                        ) : null}
                        {hasNorthGuard ? (
                          <Text testID={`map-guarded-doorway-${roomId}-top`} accessible={false} style={[styles.iconOverlay, styles.guardMarker, styles.northGuard]}>×</Text>
                        ) : null}
                        {hasEastLock ? (
                          <Text testID={`map-locked-doorway-${roomId}-right`} accessible={false} style={[styles.iconOverlay, styles.lockIcon, styles.eastLock]}>🔒</Text>
                        ) : null}
                        {hasEastGuard ? (
                          <Text testID={`map-guarded-doorway-${roomId}-right`} accessible={false} style={[styles.iconOverlay, styles.guardMarker, styles.eastGuard]}>×</Text>
                        ) : null}
                        {hasSouthLock ? (
                          <Text testID={`map-locked-doorway-${roomId}-bottom`} accessible={false} style={[styles.iconOverlay, styles.lockIcon, styles.southLock]}>🔒</Text>
                        ) : null}
                        {hasSouthGuard ? (
                          <Text testID={`map-guarded-doorway-${roomId}-bottom`} accessible={false} style={[styles.iconOverlay, styles.guardMarker, styles.southGuard]}>×</Text>
                        ) : null}
                        {hasWestLock ? (
                          <Text testID={`map-locked-doorway-${roomId}-left`} accessible={false} style={[styles.iconOverlay, styles.lockIcon, styles.westLock]}>🔒</Text>
                        ) : null}
                        {hasWestGuard ? (
                          <Text testID={`map-guarded-doorway-${roomId}-left`} accessible={false} style={[styles.iconOverlay, styles.guardMarker, styles.westGuard]}>×</Text>
                        ) : null}
                        {hasStairs ? (
                          <PixelSprite sprite="stairs_graphic" label="Stairs" size={20} />
                        ) : null}
                        {hasWerewolf ? (
                          <PixelSprite sprite="werewolf_graphic" label="Werewolf" size={12} />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, compact: boolean, veryCompact: boolean) {
  return StyleSheet.create({
    wrapper: {
      alignSelf: "stretch",
      gap: 4,
      width: "100%",
    },
    compactWrapper: {
      alignSelf: "center",
      maxWidth: veryCompact ? 140 : 180,
    },
    body: {
      flexDirection: "row",
      gap: 4,
    },
    title: {
      color: colors.ink,
      fontSize: veryCompact ? 10 : 14,
      fontWeight: "900",
      lineHeight: 18,
      textAlign: "center",
    },
    columnHeaderRow: {
      flexDirection: "row",
      gap: 2,
      paddingRight: 2,
    },
    cornerLabel: {
      width: 24,
    },
    columnLabel: {
      color: colors.fadedInk,
      flex: 1,
      fontSize: compact ? 11 : 17,
      fontVariant: ["tabular-nums"],
      fontWeight: "900",
      lineHeight: compact ? 12 : 20,
      textAlign: "center",
    },
    currentAxisLabel: {
      color: colors.mapCurrentRoom,
    },
    rowLabels: {
      gap: 2,
      width: 20,
    },
    rowLabel: {
      color: colors.fadedInk,
      flex: 1,
      fontSize: compact ? 11 : 16,
      fontVariant: ["tabular-nums"],
      fontWeight: "900",
      lineHeight: compact ? 10 : 14,
      textAlign: "right",
      textAlignVertical: "center",
    },
    grid: {
      borderColor: colors.mapGrid,
      borderLeftWidth: 1,
      borderTopWidth: 1,
      flex: 1,
    },
    gridRow: {
      flex: 1,
      flexDirection: "row",
    },
    gridCell: {
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: colors.mapGrid,
      borderRightWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: veryCompact ? 8 : compact ? 12 : 22,
      position: "relative",
    },
    room: {
      alignItems: "center",
      backgroundColor: colors.mapExploredRoom,
      borderColor: colors.ink,
      borderWidth: 1,
      height: "60%",
      justifyContent: "center",
      position: "relative",
      width: "60%",
      zIndex: 1,
    },
    playerMarkers: {
      alignItems: "center",
      flexDirection: "row",
      gap: 1,
      position: "absolute",
      right: 1,
      top: 1,
      zIndex: 2,
    },
    playerMarker: {
      borderColor: "#ffffff",
      borderRadius: 999,
      borderWidth: 1,
      height: 9,
      width: 9,
    },
    currentRoom: {
      borderColor: colors.accent,
      borderWidth: 3,
    },
    iconOverlay: { position: "absolute" },
    lockIcon: { fontSize: 12, lineHeight: 14, textAlign: "center" },
    corridor: {
      backgroundColor: colors.ink,
      position: "absolute",
      zIndex: 2,
    },
    northCorridor: {
      height: "20%",
      left: "41%",
      top: -1,
      width: "18%",
    },
    northLock: {
      left: "50%",
      top: -11,
      transform: [{ translateX: -6 }],
      width: 12,
    },
    northGuard: {
      left: "50%",
      top: -11,
      transform: [{ translateX: -6 }],
      width: 12,
    },
    eastCorridor: {
      height: "24%",
      right: -1,
      top: "38%",
      width: "20%",
    },
    eastLock: {
      right: -13,
      top: "50%",
      transform: [{ translateY: -7 }],
      width: 12,
    },
    eastGuard: {
      right: -13,
      top: "50%",
      transform: [{ translateY: -7 }],
      width: 12,
    },
    southCorridor: {
      bottom: -1,
      height: "20%",
      left: "41%",
      width: "18%",
    },
    southLock: {
      bottom: -11,
      left: "50%",
      transform: [{ translateX: -6 }],
      width: 12,
    },
    southGuard: {
      bottom: -11,
      left: "50%",
      transform: [{ translateX: -6 }],
      width: 12,
    },
    westCorridor: {
      height: "24%",
      left: -1,
      top: "38%",
      width: "20%",
    },
    westLock: {
      left: -11,
      top: "50%",
      transform: [{ translateY: -7 }],
      width: 12,
    },
    westGuard: {
      left: -13,
      top: "50%",
      transform: [{ translateY: -7 }],
      width: 12,
    },
    guardMarker: {
      color: "#dc2626",
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 14,
      textAlign: "center",
    },
  });
}
